import { and, eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { assetModificationRequests, assets, assetTypeFields, labAssignments, labs } from '@/db/schema';
import { assertCsrf, CsrfError } from '@/lib/csrf';
import { canAccessCollege, getSession } from '@/lib/auth-jwt';
import { EDITABLE_ASSET_FIELDS, normalizeAssetField, validateReviewNote } from '@/lib/assetModification';
import { logAudit } from '@/lib/audit';
import { logger, sanitizeError } from '@/lib/logger';
import { getClientIdentifier, rateLimit, RateLimitError } from '@/lib/rateLimit';
import { ValidationError } from '@/lib/validation';
import { validateCustomFieldValues } from '@/lib/customFields';
import { notifyAssetChange } from '@/lib/notify';

export async function reviewAssetModification(
  request: NextRequest,
  params: Promise<{ id: string }>,
  decision: 'approved' | 'rejected',
) {
  try {
    assertCsrf(request);
  } catch (error) {
    if (error instanceof CsrfError) return NextResponse.json({ error: 'Cross-origin request blocked' }, { status: 403 });
    throw error;
  }

  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.user.role !== 'admin' && session.user.role !== 'main_technician') return NextResponse.json({ error: 'Only admins and assigned head technicians may review modification requests' }, { status: 403 });
    const clientId = getClientIdentifier(request);
    await rateLimit(`asset-modification-requests:review:${clientId}`, { windowMs: 60000, maxRequests: 20 });

    const { id } = await params;
    const requestId = Number(id);
    if (!Number.isInteger(requestId) || requestId <= 0) return NextResponse.json({ error: 'Invalid request ID' }, { status: 400 });
    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'Request body must be an object' }, { status: 400 });
    const input = body as Record<string, unknown>;
    const unknownFields = Object.keys(input).filter((key) => key !== 'reviewNote');
    if (unknownFields.length) return NextResponse.json({ error: `Unknown review field: ${unknownFields[0]}` }, { status: 400 });
    const reviewNote = validateReviewNote(input.reviewNote);

    const result = await db.transaction(async (tx) => {
      const [modificationRequest] = await tx.select().from(assetModificationRequests)
        .where(eq(assetModificationRequests.id, requestId)).for('update').limit(1);
      if (!modificationRequest) return { status: 404 as const, error: 'Modification request not found' };
      if (modificationRequest.status !== 'pending') return { status: 409 as const, error: 'Modification request has already been reviewed' };

      if (session.user.role === 'admin') {
        if (!canAccessCollege(session.user, modificationRequest.collegeId)) return { status: 403 as const, error: 'Forbidden' };
      } else {
        // Read the current assignment inside the review transaction. A revoked
        // assignment therefore removes review access immediately.
        const [assignment] = await tx.select({ id: labAssignments.id })
          .from(labAssignments)
          .innerJoin(labs, eq(labAssignments.labId, labs.id))
          .where(and(
            eq(labAssignments.userId, session.user.id),
            eq(labAssignments.labId, modificationRequest.labId),
            eq(labs.collegeId, modificationRequest.collegeId),
          )).limit(1);
        if (!assignment || !canAccessCollege(session.user, modificationRequest.collegeId)) return { status: 403 as const, error: 'You are not assigned to this lab' };
      }

      if (decision === 'rejected') {
        const [updated] = await tx.update(assetModificationRequests).set({ status: 'rejected', reviewedById: session.user.id, reviewNote, reviewedAt: new Date() })
          .where(and(eq(assetModificationRequests.id, requestId), eq(assetModificationRequests.status, 'pending'))).returning();
        if (!updated) return { status: 409 as const, error: 'Modification request has already been reviewed' };
        return { status: 200 as const, request: updated, assetChanges: null as Record<string, unknown> | null };
      }

      if (modificationRequest.assetId === null) return { status: 409 as const, error: 'The asset was deleted; this request can no longer be approved' };
      const [asset] = await tx.select().from(assets).where(eq(assets.id, modificationRequest.assetId)).for('update').limit(1);
      if (!asset) return { status: 409 as const, error: 'The asset no longer exists; this request can no longer be approved' };
      if (asset.removedAt) return { status: 409 as const, error: 'Removed assets cannot be changed' };
      if (asset.labId !== modificationRequest.labId || asset.collegeId !== modificationRequest.collegeId) return { status: 409 as const, error: 'The asset moved after this request was submitted; submit a new request' };

      const proposal = modificationRequest.proposedChanges as Record<string, unknown>;
      const originals = modificationRequest.originalValues as Record<string, unknown>;
      for (const field of Object.keys(proposal)) {
        if (!(EDITABLE_ASSET_FIELDS as readonly string[]).includes(field)) return { status: 409 as const, error: 'The request contains a non-editable field' };
        const editableField = field as typeof EDITABLE_ASSET_FIELDS[number];
        if (JSON.stringify(normalizeAssetField(editableField, asset[editableField])) !== JSON.stringify(originals[field])) {
          return { status: 409 as const, error: `Asset field "${field}" changed after the request was submitted` };
        }
      }
      if (Object.hasOwn(proposal, 'customFields')) {
        if (asset.assetTypeId !== modificationRequest.assetTypeId) return { status: 409 as const, error: 'The asset type changed after the request was submitted' };
        if (!asset.assetTypeId) return { status: 409 as const, error: 'The asset no longer has a custom field type' };
        const definitions = await tx.select().from(assetTypeFields).where(eq(assetTypeFields.assetTypeId, asset.assetTypeId));
        try { validateCustomFieldValues(definitions, proposal.customFields); }
        catch { return { status: 409 as const, error: 'Custom field definitions changed after the request was submitted' }; }
      }

      const setValues: Record<string, unknown> = { updatedById: session.user.id, updatedAt: new Date() };
      for (const [field, value] of Object.entries(proposal)) {
        setValues[field] = field === 'purchaseDate' || field === 'warrantyExpiry'
          ? (value === null ? null : new Date(String(value)))
          : value;
      }
      const [updatedAsset] = await tx.update(assets).set(setValues as any).where(eq(assets.id, asset.id)).returning();
      const [updatedRequest] = await tx.update(assetModificationRequests).set({ status: 'approved', reviewedById: session.user.id, reviewNote, reviewedAt: new Date() })
        .where(and(eq(assetModificationRequests.id, requestId), eq(assetModificationRequests.status, 'pending'))).returning();
      if (!updatedRequest) return { status: 409 as const, error: 'Modification request has already been reviewed' };
      const assetDiff = Object.fromEntries(Object.keys(proposal).map((field) => [field, { from: (asset as any)[field], to: (updatedAsset as any)[field] }]));
      return { status: 200 as const, request: updatedRequest, assetChanges: assetDiff, asset: updatedAsset };
    });

    if (result.status !== 200) return NextResponse.json({ error: result.error }, { status: result.status });
    await logAudit({ userId: session.user.id, action: decision === 'approved' ? 'APPROVE' : 'REJECT', entityType: 'asset_modification_request', entityId: requestId, changes: { status: decision, reviewNote } });
    if (result.assetChanges) await logAudit({ userId: session.user.id, action: 'UPDATE', entityType: 'asset', entityId: result.request.assetId!, changes: result.assetChanges });
    if (result.assetChanges && result.asset) await notifyAssetChange({ action: 'updated', assetName: result.asset.name, labId: result.asset.labId, actor: { id: session.user.id, name: session.user.name }, changes: result.assetChanges as Record<string, unknown>, assetTypeId: result.asset.assetTypeId });
    return NextResponse.json({ data: result.request, asset: result.asset ?? null });
  } catch (error) {
    if (error instanceof ValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof RateLimitError) return NextResponse.json({ error: 'Rate limit exceeded', retryAfter: error.retryAfter }, { status: 429, headers: { 'Retry-After': error.retryAfter.toString() } });
    logger.error('Error reviewing asset modification request', { error, decision });
    return NextResponse.json({ error: sanitizeError(error) }, { status: 500 });
  }
}
