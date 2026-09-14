import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { assets, labs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { validateAssetInput, ValidationError } from '@/lib/validation';
import { rateLimit, getClientIdentifier, RateLimitError } from '@/lib/rateLimit';
import { assertCsrf, CsrfError } from '@/lib/csrf';
import { logger, sanitizeError } from '@/lib/logger';
import { getSession, canDeleteAssets, canAccessCollege } from '@/lib/auth-jwt';
import { logAudit } from '@/lib/audit';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Rate limiting
    const clientId = getClientIdentifier(request);
    await rateLimit(`assets:get:${clientId}`, { windowMs: 60000, maxRequests: 60 });

    const { id } = await params;
    const assetId = parseInt(id, 10);

    if (isNaN(assetId) || assetId <= 0) {
      return NextResponse.json(
        { error: 'Invalid asset ID' },
        { status: 400 }
      );
    }

    const asset = await db.select().from(assets).where(eq(assets.id, assetId));

    if (asset.length === 0) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      );
    }

    if (!canAccessCollege(session.user, asset[0].collegeId)) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(asset[0]);
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: error.retryAfter },
        { 
          status: 429,
          headers: { 'Retry-After': error.retryAfter.toString() }
        }
      );
    }

    logger.error('Error fetching asset', { error });
    return NextResponse.json(
      { error: sanitizeError(error) },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    assertCsrf(request);
  } catch (error) {
    if (error instanceof CsrfError) {
      return NextResponse.json(
        { error: 'Cross-origin request blocked' },
        { status: 403 }
      );
    }
    throw error;
  }

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Rate limiting - stricter for writes
    const clientId = getClientIdentifier(request);
    await rateLimit(`assets:put:${clientId}`, { windowMs: 60000, maxRequests: 20 });

    const { id } = await params;
    const assetId = parseInt(id, 10);

    if (isNaN(assetId) || assetId <= 0) {
      return NextResponse.json(
        { error: 'Invalid asset ID' },
        { status: 400 }
      );
    }

    const existing = await db.select().from(assets).where(eq(assets.id, assetId)).limit(1);
    if (existing.length === 0) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      );
    }

    if (!canAccessCollege(session.user, existing[0].collegeId)) {
      return NextResponse.json(
        { error: 'Forbidden: You cannot modify equipment belonging to another institution' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = validateAssetInput(body);

    const labId = body.labId !== undefined ? parseInt(body.labId, 10) : undefined;
    if (labId !== undefined && (isNaN(labId) || labId <= 0)) {
      return NextResponse.json(
        { error: 'Invalid lab ID' },
        { status: 400 }
      );
    }

    if (labId !== undefined) {
      // Institution isolation on the TARGET lab: moving an asset into a lab
      // is only allowed if that lab belongs to the user's college (admins
      // exempt). Without this, a technician could move assets cross-college.
      const targetLab = await db.select().from(labs).where(eq(labs.id, labId)).limit(1);
      if (targetLab.length === 0) {
        return NextResponse.json(
          { error: 'Specified lab does not exist.' },
          { status: 404 }
        );
      }
      if (!canAccessCollege(session.user, targetLab[0].collegeId)) {
        return NextResponse.json(
          { error: 'Forbidden: You cannot move equipment to a laboratory outside your assigned institution.' },
          { status: 403 }
        );
      }
      // Keep the asset's college in sync with its lab so tenant alignment
      // can never drift when the labId changes.
      existing[0].collegeId = targetLab[0].collegeId;
    }

    const updatedAsset = await db.update(assets)
      .set({
        name: validatedData.name,
        category: validatedData.category,
        manufacturer: validatedData.manufacturer || null,
        model: validatedData.model || null,
        serialNumber: validatedData.serialNumber || null,
        ...(labId !== undefined && { labId }),
        collegeId: existing[0].collegeId,
        location: validatedData.location,
        status: validatedData.status,
        purchaseDate: validatedData.purchaseDate || null,
        warrantyExpiry: validatedData.warrantyExpiry || null,
        notes: validatedData.notes || null,
        updatedById: session.user.id,
        updatedAt: new Date(),
      })
      .where(eq(assets.id, assetId))
      .returning();

    // Field-level diff for the audit trail: only what actually changed.
    const trackedFields = [
      'name', 'category', 'manufacturer', 'model', 'serialNumber',
      'location', 'status', 'purchaseDate', 'warrantyExpiry', 'notes',
    ] as const;
    const before = existing[0];
    const after = updatedAsset[0];
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const field of trackedFields) {
      const prev = before[field] ?? null;
      const next = after[field] ?? null;
      if (prev !== next) changes[field] = { from: prev, to: next };
    }
    if (labId !== undefined) {
      changes.labId = { from: before.labId, to: after.labId };
      changes.collegeId = { from: before.collegeId, to: after.collegeId };
    }
    await logAudit({
      userId: session.user.id,
      action: 'UPDATE',
      entityType: 'asset',
      entityId: assetId,
      changes: Object.keys(changes).length > 0 ? changes : { unchanged: true },
    });

    if (updatedAsset.length === 0) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      );
    }

    logger.info('Asset updated', { assetId, name: updatedAsset[0].name });

    return NextResponse.json(updatedAsset[0]);
  } catch (error) {

    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: error.retryAfter },
        { 
          status: 429,
          headers: { 'Retry-After': error.retryAfter.toString() }
        }
      );
    }

    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    logger.error('Error updating asset', { error });
    return NextResponse.json(
      { error: sanitizeError(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    assertCsrf(request);
  } catch (error) {
    if (error instanceof CsrfError) {
      return NextResponse.json(
        { error: 'Cross-origin request blocked' },
        { status: 403 }
      );
    }
    throw error;
  }

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check permission - only admin and main_technician can delete
    if (!canDeleteAssets(session.user.role)) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have permission to delete assets' },
        { status: 403 }
      );
    }

    // Rate limiting - stricter for deletes
    const clientId = getClientIdentifier(request);
    await rateLimit(`assets:delete:${clientId}`, { windowMs: 60000, maxRequests: 10 });

    const { id } = await params;
    const assetId = parseInt(id, 10);

    if (isNaN(assetId) || assetId <= 0) {
      return NextResponse.json(
        { error: 'Invalid asset ID' },
        { status: 400 }
      );
    }

    const existing = await db.select().from(assets).where(eq(assets.id, assetId)).limit(1);
    if (existing.length === 0) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      );
    }

    if (!canAccessCollege(session.user, existing[0].collegeId)) {
      return NextResponse.json(
        { error: 'Forbidden: You cannot delete equipment belonging to another institution' },
        { status: 403 }
      );
    }
    const deletedAsset = await db.delete(assets)
      .where(eq(assets.id, assetId))
      .returning();

    if (deletedAsset.length === 0) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      );
    }

    logger.info('Asset deleted', { assetId, name: deletedAsset[0].name });
    // Snapshot the deleted asset — its row is gone, so this is the only
    // surviving record of what it was.
    await logAudit({
      userId: session.user.id,
      action: 'DELETE',
      entityType: 'asset',
      entityId: assetId,
      changes: {
        name: deletedAsset[0].name,
        category: deletedAsset[0].category,
        serialNumber: deletedAsset[0].serialNumber,
        status: deletedAsset[0].status,
        collegeId: deletedAsset[0].collegeId,
        labId: deletedAsset[0].labId,
      },
    });

    return NextResponse.json({ message: 'Asset deleted successfully' });
  } catch (error) {

    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: error.retryAfter },
        { 
          status: 429,
          headers: { 'Retry-After': error.retryAfter.toString() }
        }
      );
    }

    logger.error('Error deleting asset', { error });
    return NextResponse.json(
      { error: sanitizeError(error) },
      { status: 500 }
    );
  }
}