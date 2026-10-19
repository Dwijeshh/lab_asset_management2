import { NextRequest, NextResponse } from 'next/server';
import { readJsonBody } from '@/lib/requestBody';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { assetModificationRequests, assets, assetTypeFields, labAssignments, labs, users } from '@/db/schema';
import { assertCsrf, CsrfError } from '@/lib/csrf';
import { canAccessCollege, getSession, resolveCollegeFilter } from '@/lib/auth-jwt';
import { logAudit } from '@/lib/audit';
import { logger, sanitizeError } from '@/lib/logger';
import { getClientIdentifier, rateLimit, RateLimitError } from '@/lib/rateLimit';
import { validatePagination, ValidationError } from '@/lib/validation';
import { validateProposedChanges, validateReason } from '@/lib/assetModification';
import { validateCustomFieldValues } from '@/lib/customFields';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const clientId = getClientIdentifier(request);
    await rateLimit(`asset-modification-requests:get:${clientId}`, { windowMs: 60000, maxRequests: 60 });
    const { page, limit } = validatePagination(request.nextUrl.searchParams);
    const conditions = [];

    if (session.user.role === 'technician') {
      conditions.push(eq(assetModificationRequests.requestedById, session.user.id));
      conditions.push(eq(assetModificationRequests.collegeId, session.user.collegeId));
    } else if (session.user.role === 'main_technician') {
      const assignments = await db.select({ labId: labAssignments.labId })
        .from(labAssignments)
        .where(eq(labAssignments.userId, session.user.id));
      const labIds = assignments.map((assignment) => assignment.labId);
      if (!labIds.length) return NextResponse.json({ data: [], pagination: { page, limit } });
      conditions.push(inArray(assetModificationRequests.labId, labIds));
      conditions.push(eq(assetModificationRequests.collegeId, session.user.collegeId));
    } else if (session.user.role === 'admin') {
      try {
        const collegeId = resolveCollegeFilter(session.user, request.nextUrl.searchParams.get('collegeId'));
        if (collegeId !== null) conditions.push(eq(assetModificationRequests.collegeId, collegeId));
      } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid collegeId' }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const query = db.select({
      request: assetModificationRequests,
      requester: { id: users.id, name: users.name, email: users.email },
      asset: { id: assets.id, name: assets.name },
    }).from(assetModificationRequests)
      .leftJoin(users, eq(assetModificationRequests.requestedById, users.id))
      .leftJoin(assets, eq(assetModificationRequests.assetId, assets.id));
    const rows = await query
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(assetModificationRequests.createdAt))
      .limit(limit)
      .offset((page - 1) * limit);
    const typeIds = [...new Set(rows.map((row) => row.request.assetTypeId).filter((id): id is number => id !== null))];
    const fieldDefinitions = typeIds.length ? await db.select({ assetTypeId: assetTypeFields.assetTypeId, fieldKey: assetTypeFields.fieldKey, label: assetTypeFields.label }).from(assetTypeFields).where(inArray(assetTypeFields.assetTypeId, typeIds)) : [];
    const labelsByType = new Map<number, Record<string, string>>();
    for (const definition of fieldDefinitions) labelsByType.set(definition.assetTypeId, { ...(labelsByType.get(definition.assetTypeId) || {}), [definition.fieldKey]: definition.label });
    return NextResponse.json({ data: rows.map((row) => ({ ...row, fieldLabels: labelsByType.get(row.request.assetTypeId || 0) || {} })), pagination: { page, limit } });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: 'Rate limit exceeded', retryAfter: error.retryAfter }, { status: 429, headers: { 'Retry-After': error.retryAfter.toString() } });
    }
    logger.error('Error listing asset modification requests', { error });
    return NextResponse.json({ error: sanitizeError(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    assertCsrf(request);
  } catch (error) {
    if (error instanceof CsrfError) return NextResponse.json({ error: 'Cross-origin request blocked' }, { status: 403 });
    throw error;
  }

  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.user.role !== 'technician') return NextResponse.json({ error: 'Only technicians may submit modification requests' }, { status: 403 });
    const clientId = getClientIdentifier(request);
    await rateLimit(`asset-modification-requests:post:${clientId}`, { windowMs: 60000, maxRequests: 20 });

    const parsedBody = await readJsonBody(request);
    if (!parsedBody.ok) return parsedBody.response;
    const body: unknown = parsedBody.data;
    if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'Request body must be an object' }, { status: 400 });
    const data = body as Record<string, unknown>;
    const unknownFields = Object.keys(data).filter((key) => !['assetId', 'proposedChanges', 'reason'].includes(key));
    if (unknownFields.length) return NextResponse.json({ error: `Unknown request field: ${unknownFields[0]}` }, { status: 400 });
    const assetId = typeof data.assetId === 'number' ? data.assetId : Number(data.assetId);
    if (!Number.isInteger(assetId) || assetId <= 0) return NextResponse.json({ error: 'Invalid asset ID' }, { status: 400 });
    const reason = validateReason(data.reason);

    const asset = await db.query.assets.findFirst({ where: eq(assets.id, assetId) });
    if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    if (asset.removedAt) return NextResponse.json({ error: 'Removed assets cannot be edited' }, { status: 409 });
    if (!canAccessCollege(session.user, asset.collegeId)) return NextResponse.json({ error: 'You may request edits only within your college' }, { status: 403 });
    if (!session.user.labId || asset.labId !== session.user.labId) return NextResponse.json({ error: 'You may request edits only for assets in your assigned lab' }, { status: 403 });

    const { proposedChanges, originalValues } = validateProposedChanges(asset, data.proposedChanges);
    if (Object.hasOwn(proposedChanges, 'customFields')) {
      if (!asset.assetTypeId) return NextResponse.json({ error: 'This asset has no configurable custom fields' }, { status: 400 });
      const definitions = await db.select().from(assetTypeFields).where(eq(assetTypeFields.assetTypeId, asset.assetTypeId));
      proposedChanges.customFields = validateCustomFieldValues(definitions, proposedChanges.customFields);
    }
    const inserted = await db.insert(assetModificationRequests).values({
      collegeId: asset.collegeId!,
      assetId: asset.id,
      assetTypeId: asset.assetTypeId,
      assetName: asset.name,
      labId: asset.labId,
      requestedById: session.user.id,
      proposedChanges,
      originalValues,
      reason,
    }).returning();

    await logAudit({ userId: session.user.id, action: 'CREATE', entityType: 'asset_modification_request', entityId: inserted[0].id, changes: { assetId, proposedChanges } });
    return NextResponse.json({ data: inserted[0] }, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: 'Rate limit exceeded', retryAfter: error.retryAfter }, { status: 429, headers: { 'Retry-After': error.retryAfter.toString() } });
    }
    logger.error('Error creating asset modification request', { error });
    return NextResponse.json({ error: sanitizeError(error) }, { status: 500 });
  }
}
