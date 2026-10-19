import { NextRequest, NextResponse } from 'next/server';
import { readJsonBody } from '@/lib/requestBody';
import { db } from '@/db';
import { assets, labs, assetLoans, assetRequests, assetTypes, assetTypeFields } from '@/db/schema';
import { eq, and, count, isNull } from 'drizzle-orm';
import { validateAssetInput, ValidationError } from '@/lib/validation';
import { rateLimit, getClientIdentifier, RateLimitError } from '@/lib/rateLimit';
import { assertCsrf, CsrfError } from '@/lib/csrf';
import { logger, sanitizeError } from '@/lib/logger';
import { getSession, canDeleteAssets, canAccessCollege, canManageLab } from '@/lib/auth-jwt';
import { logAudit } from '@/lib/audit';
import { notifyAssetChange } from '@/lib/notify';
import { validateCustomFieldValues } from '@/lib/customFields';

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

    const asset = await db.select({ asset: assets, assetTypeName: assetTypes.name }).from(assets).leftJoin(assetTypes, eq(assets.assetTypeId, assetTypes.id)).where(and(eq(assets.id, assetId), isNull(assets.removedAt)));

    if (asset.length === 0) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      );
    }

    if (!canAccessCollege(session.user, asset[0].asset.collegeId)) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      );
    }

    // The collection endpoint is lab-scoped for technicians; keep direct
    // object lookups at the same visibility boundary to prevent IDOR reads.
    if (session.user.role === 'technician' && session.user.labId !== asset[0].asset.labId) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    const fields = asset[0].asset.assetTypeId ? await db.select().from(assetTypeFields).where(eq(assetTypeFields.assetTypeId, asset[0].asset.assetTypeId)) : [];
    const labels = new Map(fields.map((field) => [field.fieldKey, field.label]));
    return NextResponse.json({ ...asset[0].asset, assetTypeName: asset[0].assetTypeName, customFieldDisplay: Object.entries(asset[0].asset.customFields || {}).map(([key, value]) => ({ label: labels.get(key) || key, value })) });
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

    if (existing[0].removedAt) {
      return NextResponse.json({ error: 'Removed assets cannot be edited' }, { status: 409 });
    }

    if (!canAccessCollege(session.user, existing[0].collegeId)) {
      return NextResponse.json(
        { error: 'Forbidden: You cannot modify equipment belonging to another institution' },
        { status: 403 }
      );
    }

    if (!(await canManageLab(session.user, existing[0].labId))) {
      return NextResponse.json(
        { error: 'You are not assigned to this lab' },
        { status: 403 }
      );
    }

    const parsedBody = await readJsonBody(request);
    if (!parsedBody.ok) return parsedBody.response;
    const body = parsedBody.data as Record<string, any>;
    const validatedData = validateAssetInput(body);

    const labId = body.labId !== undefined ? parseInt(body.labId, 10) : undefined;
    if (labId !== undefined && (isNaN(labId) || labId <= 0)) {
      return NextResponse.json(
        { error: 'Invalid lab ID' },
        { status: 400 }
      );
    }

    if (labId !== undefined && labId !== existing[0].labId) {
      if (!(await canManageLab(session.user, labId))) {
        return NextResponse.json(
          { error: 'You are not assigned to this lab' },
          { status: 403 }
        );
      }
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
      const crossesCollege = existing[0].collegeId !== targetLab[0].collegeId;
      existing[0].collegeId = targetLab[0].collegeId;
      // Asset types are college-scoped. When an admin moves a legacy asset
      // across colleges without explicitly choosing a destination type,
      // resolve the destination college's type for the same legacy category.
      if (crossesCollege) existing[0].assetTypeId = null;
    }

    const explicitTypeId = body.assetTypeId === undefined ? existing[0].assetTypeId : (body.assetTypeId === '' || body.assetTypeId === null ? null : Number(body.assetTypeId));
    const [legacyType] = explicitTypeId === null ? await db.select().from(assetTypes).where(and(eq(assetTypes.collegeId, existing[0].collegeId!), eq(assetTypes.legacyCategory, validatedData.category))).limit(1) : [];
    const targetTypeId = explicitTypeId ?? legacyType?.id ?? null;
    let customFields = existing[0].customFields || {};
    if (targetTypeId !== null) {
      if (!Number.isInteger(targetTypeId) || targetTypeId <= 0) return NextResponse.json({ error: 'Invalid asset type' }, { status: 400 });
      const [type] = await db.select().from(assetTypes).where(and(eq(assetTypes.id, targetTypeId), eq(assetTypes.collegeId, existing[0].collegeId!))).limit(1);
      if (!type) return NextResponse.json({ error: 'Asset type must belong to the lab college' }, { status: 400 });
      const fields = await db.select().from(assetTypeFields).where(eq(assetTypeFields.assetTypeId, targetTypeId));
      customFields = validateCustomFieldValues(fields, body.customFields ?? customFields);
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
        assetTypeId: targetTypeId,
        customFields,
        updatedById: session.user.id,
        updatedAt: new Date(),
      })
      .where(eq(assets.id, assetId))
      .returning();

    // Field-level diff for the audit trail: only what actually changed.
    const trackedFields = [
      'name', 'category', 'manufacturer', 'model', 'serialNumber',
      'location', 'status', 'purchaseDate', 'warrantyExpiry', 'notes',
      'assetTypeId', 'customFields',
    ] as const;
    const before = existing[0];
    const after = updatedAsset[0];
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const field of trackedFields) {
      const prev = before[field] ?? null;
      const next = after[field] ?? null;
      if (JSON.stringify(prev) !== JSON.stringify(next)) changes[field] = { from: prev, to: next };
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

    await notifyAssetChange({
      action: 'updated',
      assetName: updatedAsset[0].name,
      labId: updatedAsset[0].labId,
      oldLabId: before.labId !== after.labId ? before.labId : undefined,
      actor: { id: session.user.id, name: session.user.name },
      changes,
      assetTypeId: updatedAsset[0].assetTypeId,
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

    if (existing[0].removedAt) {
      return NextResponse.json({ error: 'Asset has already been removed' }, { status: 409 });
    }

    if (!canAccessCollege(session.user, existing[0].collegeId)) {
      return NextResponse.json(
        { error: 'Forbidden: You cannot delete equipment belonging to another institution' },
        { status: 403 }
      );
    }

    if (!(await canManageLab(session.user, existing[0].labId))) {
      return NextResponse.json(
        { error: 'You are not assigned to this lab' },
        { status: 403 }
      );
    }

    const parsedBody = await readJsonBody(request);
    if (!parsedBody.ok) return parsedBody.response;
    const body = parsedBody.data as Record<string, any>;
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (!reason) {
      return NextResponse.json({ error: 'A removal reason is required' }, { status: 400 });
    }
    if (reason.length > 2000) {
      return NextResponse.json({ error: 'Removal reason must be 2000 characters or fewer' }, { status: 400 });
    }

    const outcome = await db.transaction(async (tx) => {
      const [lockedAsset] = await tx.select().from(assets).where(eq(assets.id, assetId)).for('update').limit(1);
      if (!lockedAsset) return { status: 404 as const, error: 'Asset not found' };
      if (lockedAsset.removedAt) return { status: 409 as const, error: 'Asset has already been removed' };
      if (!canAccessCollege(session.user, lockedAsset.collegeId)) return { status: 403 as const, error: 'Forbidden' };
      if (!(await canManageLab(session.user, lockedAsset.labId))) return { status: 403 as const, error: 'You are not assigned to this lab' };
      const [activeLoanCount] = await tx.select({ value: count() }).from(assetLoans).where(and(eq(assetLoans.assetId, assetId), eq(assetLoans.status, 'active')));
      const [pendingRequestCount] = await tx.select({ value: count() }).from(assetRequests).where(and(eq(assetRequests.assetId, assetId), eq(assetRequests.status, 'pending')));
      if (activeLoanCount.value || pendingRequestCount.value) return { status: 409 as const, error: 'Resolve active loans and pending borrowing or transfer requests before removing this asset' };
      const [asset] = await tx.update(assets).set({ removedAt: new Date(), removedById: session.user.id, removalReason: reason, updatedById: session.user.id, updatedAt: new Date() }).where(and(eq(assets.id, assetId), isNull(assets.removedAt))).returning();
      return asset ? { status: 200 as const, asset } : { status: 409 as const, error: 'Asset has already been removed' };
    });
    if (outcome.status !== 200) return NextResponse.json({ error: outcome.error }, { status: outcome.status });
    const removedAsset = [outcome.asset];

    logger.info('Asset removed', { assetId, name: removedAsset[0].name });
    await logAudit({
      userId: session.user.id,
      action: 'DELETE',
      entityType: 'asset',
      entityId: assetId,
      changes: {
        name: removedAsset[0].name,
        category: removedAsset[0].category,
        serialNumber: removedAsset[0].serialNumber,
        status: removedAsset[0].status,
        collegeId: removedAsset[0].collegeId,
        labId: removedAsset[0].labId,
        removedAt: removedAsset[0].removedAt,
        removedById: removedAsset[0].removedById,
        removalReason: reason,
      },
    });

    await notifyAssetChange({
      action: 'deleted',
      assetName: removedAsset[0].name,
      labId: removedAsset[0].labId,
      assetTypeId: removedAsset[0].assetTypeId,
      actor: { id: session.user.id, name: session.user.name },
    });

    return NextResponse.json({ message: 'Asset removed successfully' });
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
