import { NextRequest, NextResponse } from 'next/server';
import { readJsonBody } from '@/lib/requestBody';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { assetTypeFields, assetTypes } from '@/db/schema';
import { getSession } from '@/lib/auth-jwt';
import { assertCsrf, CsrfError } from '@/lib/csrf';
import { logger, sanitizeError } from '@/lib/logger';
import { validateFieldDefinitions } from '@/lib/customFields';
import { ValidationError } from '@/lib/validation';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const collegeId = session.user.role === 'admin' && request.nextUrl.searchParams.get('collegeId')
    ? Number(request.nextUrl.searchParams.get('collegeId')) : session.user.collegeId;
  if (!Number.isInteger(collegeId) || collegeId <= 0) return NextResponse.json({ error: 'Invalid collegeId' }, { status: 400 });
  const types = await db.select().from(assetTypes).where(eq(assetTypes.collegeId, collegeId)).orderBy(assetTypes.name);
  const data = await Promise.all(types.map(async (type) => ({
    ...type,
    fields: await db.select().from(assetTypeFields).where(eq(assetTypeFields.assetTypeId, type.id)).orderBy(assetTypeFields.displayOrder),
  })));
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  try { assertCsrf(request); } catch (error) { if (error instanceof CsrfError) return NextResponse.json({ error: 'Cross-origin request blocked' }, { status: 403 }); throw error; }
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Only admins may manage asset types' }, { status: 403 });
  try {
    const parsedBody = await readJsonBody(request);
    if (!parsedBody.ok) return parsedBody.response;
    const body = parsedBody.data as Record<string, any>;
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const collegeId = Number(body.collegeId ?? session.user.collegeId);
    if (!name || name.length > 255 || !Number.isInteger(collegeId) || collegeId <= 0) return NextResponse.json({ error: 'A valid name and collegeId are required' }, { status: 400 });
    if (collegeId !== session.user.collegeId) return NextResponse.json({ error: 'Asset types can only be configured within your college' }, { status: 403 });
    const fields = validateFieldDefinitions(body.fields ?? []);
    const created = await db.transaction(async (tx) => {
      const [type] = await tx.insert(assetTypes).values({ collegeId, name, description: typeof body.description === 'string' ? body.description.trim() : null }).returning();
      if (fields.length) await tx.insert(assetTypeFields).values(fields.map((field) => ({ ...field, assetTypeId: type.id })));
      return type;
    });
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    logger.error('Error creating asset type', { error });
    return NextResponse.json({ error: sanitizeError(error) }, { status: 500 });
  }
}
