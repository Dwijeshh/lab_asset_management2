import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { assetModificationRequests, assets, assetTypeFields, users } from '@/db/schema';
import { getSession } from '@/lib/auth-jwt';
import { canViewModificationRequest } from '@/lib/assetModificationAccess';
import { logger, sanitizeError } from '@/lib/logger';
import { getClientIdentifier, rateLimit, RateLimitError } from '@/lib/rateLimit';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const clientId = getClientIdentifier(request);
    await rateLimit(`asset-modification-requests:get:${clientId}`, { windowMs: 60000, maxRequests: 60 });
    const { id } = await params;
    const requestId = Number(id);
    if (!Number.isInteger(requestId) || requestId <= 0) return NextResponse.json({ error: 'Invalid request ID' }, { status: 400 });

    const row = await db.query.assetModificationRequests.findFirst({ where: eq(assetModificationRequests.id, requestId) });
    if (!row) return NextResponse.json({ error: 'Modification request not found' }, { status: 404 });
    if (!(await canViewModificationRequest(session.user, row))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const [asset] = row.assetId === null ? [] : await db.select({ id: assets.id, name: assets.name }).from(assets).where(eq(assets.id, row.assetId)).limit(1);
    const [requester] = await db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(eq(users.id, row.requestedById)).limit(1);
    const [reviewer] = row.reviewedById === null ? [] : await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, row.reviewedById)).limit(1);
    const fields = row.assetTypeId === null ? [] : await db.select({ fieldKey: assetTypeFields.fieldKey, label: assetTypeFields.label }).from(assetTypeFields).where(eq(assetTypeFields.assetTypeId, row.assetTypeId));
    const fieldLabels = Object.fromEntries(fields.map((field) => [field.fieldKey, field.label]));
    return NextResponse.json({ data: { request: row, asset: asset ?? { id: null, name: row.assetName }, requester: requester ?? null, reviewer: reviewer ?? null, fieldLabels } });
  } catch (error) {
    if (error instanceof RateLimitError) return NextResponse.json({ error: 'Rate limit exceeded', retryAfter: error.retryAfter }, { status: 429, headers: { 'Retry-After': error.retryAfter.toString() } });
    logger.error('Error fetching asset modification request', { error });
    return NextResponse.json({ error: sanitizeError(error) }, { status: 500 });
  }
}
