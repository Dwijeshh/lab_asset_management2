import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { assets } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { validateAssetInput, ValidationError } from '@/lib/validation';
import { rateLimit, getClientIdentifier, RateLimitError } from '@/lib/rateLimit';
import { validateApiKey, UnauthorizedError } from '@/lib/auth';
import { logger, sanitizeError } from '@/lib/logger';
import { getSession, canDeleteAssets } from '@/lib/auth-jwt';

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
    rateLimit(`assets:get:${clientId}`, { windowMs: 60000, maxRequests: 60 });

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

    if (session.user.role !== 'admin' && asset[0].collegeId && asset[0].collegeId !== session.user.collegeId) {
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
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Rate limiting - stricter for writes
    const clientId = getClientIdentifier(request);
    rateLimit(`assets:put:${clientId}`, { windowMs: 60000, maxRequests: 20 });

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

    if (session.user.role !== 'admin' && existing[0].collegeId && existing[0].collegeId !== session.user.collegeId) {
      return NextResponse.json(
        { error: 'Forbidden: You cannot modify equipment belonging to another institution' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = validateAssetInput(body);

    // Use lab from request or keep existing (will be validated by DB)
    const labId = body.labId || undefined;

    const updatedAsset = await db.update(assets)
      .set({
        name: validatedData.name,
        category: validatedData.category,
        manufacturer: validatedData.manufacturer || null,
        model: validatedData.model || null,
        serialNumber: validatedData.serialNumber || null,
        ...(labId && { labId }),
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

    if (updatedAsset.length === 0) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      );
    }

    logger.info('Asset updated', { assetId, name: updatedAsset[0].name });

    return NextResponse.json(updatedAsset[0]);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

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
    rateLimit(`assets:delete:${clientId}`, { windowMs: 60000, maxRequests: 10 });

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

    if (session.user.role !== 'admin' && existing[0].collegeId && existing[0].collegeId !== session.user.collegeId) {
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

    return NextResponse.json({ message: 'Asset deleted successfully' });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

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