import { NextRequest, NextResponse } from 'next/server';
import { readJsonBody } from '@/lib/requestBody';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { assetTypeFields, assetTypes, assets } from '@/db/schema';
import { getSession } from '@/lib/auth-jwt';
import { assertCsrf, CsrfError } from '@/lib/csrf';
import { validateCustomFieldValues, validateFieldDefinitions } from '@/lib/customFields';
import { ValidationError } from '@/lib/validation';
import { logger, sanitizeError } from '@/lib/logger';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { assertCsrf(request); } catch (error) { if (error instanceof CsrfError) return NextResponse.json({ error: 'Cross-origin request blocked' }, { status: 403 }); throw error; }
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Only admins may manage asset types' }, { status: 403 });
  try {
    const id = Number((await params).id);
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Invalid type ID' }, { status: 400 });
    const [type] = await db.select().from(assetTypes).where(eq(assetTypes.id, id)).limit(1);
    if (!type) return NextResponse.json({ error: 'Asset type not found' }, { status: 404 });
    if (type.collegeId !== session.user.collegeId) return NextResponse.json({ error: 'Asset types can only be configured within your college' }, { status: 403 });
    const parsedBody = await readJsonBody(request);
    if (!parsedBody.ok) return parsedBody.response;
    const body = parsedBody.data as Record<string, any>;
    const name = typeof body.name === 'string' ? body.name.trim() : type.name;
    const fields = validateFieldDefinitions(body.fields);
    const assetsOfType = await db.select({ customFields: assets.customFields }).from(assets).where(eq(assets.assetTypeId, id));
    for (const asset of assetsOfType) validateCustomFieldValues(fields as any, asset.customFields || {});
    await db.transaction(async (tx) => {
      await tx.update(assetTypes).set({ name, description: typeof body.description === 'string' ? body.description.trim() : type.description, updatedAt: new Date() }).where(eq(assetTypes.id, id));
      await tx.delete(assetTypeFields).where(eq(assetTypeFields.assetTypeId, id));
      if (fields.length) await tx.insert(assetTypeFields).values(fields.map((field) => ({ ...field, assetTypeId: id })));
    });
    return NextResponse.json({ message: 'Asset type updated' });
  } catch (error) {
    if (error instanceof ValidationError) return NextResponse.json({ error: error.message }, { status: 409 });
    logger.error('Error updating asset type', { error });
    return NextResponse.json({ error: sanitizeError(error) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { assertCsrf(request); } catch (error) { if (error instanceof CsrfError) return NextResponse.json({ error: 'Cross-origin request blocked' }, { status: 403 }); throw error; }
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Only admins may manage asset types' }, { status: 403 });
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Invalid type ID' }, { status: 400 });
  const [type] = await db.select({ collegeId: assetTypes.collegeId }).from(assetTypes).where(eq(assetTypes.id, id)).limit(1);
  if (!type) return NextResponse.json({ error: 'Asset type not found' }, { status: 404 });
  if (type.collegeId !== session.user.collegeId) return NextResponse.json({ error: 'Asset types can only be configured within your college' }, { status: 403 });
  const [used] = await db.select({ id: assets.id }).from(assets).where(eq(assets.assetTypeId, id)).limit(1);
  if (used) return NextResponse.json({ error: 'This asset type is used by assets and cannot be deleted' }, { status: 409 });
  await db.delete(assetTypes).where(eq(assetTypes.id, id));
  return NextResponse.json({ message: 'Asset type deleted' });
}
