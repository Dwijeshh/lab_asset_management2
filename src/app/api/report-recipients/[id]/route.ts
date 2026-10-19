import { NextRequest, NextResponse } from 'next/server';
import { readJsonBody } from '@/lib/requestBody';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { labs, reportRecipients } from '@/db/schema';
import { getSession } from '@/lib/auth-jwt';
import { assertCsrf, CsrfError } from '@/lib/csrf';
import { validateEmail } from '@/lib/validation';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { assertCsrf(request); } catch (error) { if (error instanceof CsrfError) return NextResponse.json({ error: 'Cross-origin request blocked' }, { status: 403 }); throw error; }
  const session = await getSession(); if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Admins only' }, { status: 403 });
  const id = Number((await params).id); const [current] = await db.select().from(reportRecipients).where(eq(reportRecipients.id, id)).limit(1);
  if (!current) return NextResponse.json({ error: 'Recipient not found' }, { status: 404 });
  if (current.collegeId !== session.user.collegeId) return NextResponse.json({ error: 'Report recipients can only be managed within your college' }, { status: 403 });
  try {
    const parsedBody = await readJsonBody(request); if (!parsedBody.ok) return parsedBody.response;
    const body = parsedBody.data as Record<string, any>; const labIds: number[] = Array.isArray(body.labIds) ? [...new Set<number>((body.labIds as unknown[]).map((value) => Number(value)))] : current.labIds;
    if (!labIds.length || labIds.some((labId) => !Number.isInteger(labId) || labId <= 0)) return NextResponse.json({ error: 'At least one valid lab is required' }, { status: 400 });
    const scoped = await db.select({ id: labs.id }).from(labs).where(and(eq(labs.collegeId, current.collegeId), inArray(labs.id, labIds)));
    if (scoped.length !== labIds.length) return NextResponse.json({ error: 'Every selected lab must belong to the recipient college' }, { status: 400 });
    const [updated] = await db.update(reportRecipients).set({ email: body.email ? validateEmail(body.email) : current.email, displayName: typeof body.displayName === 'string' ? body.displayName.trim() : current.displayName, labIds, active: typeof body.active === 'boolean' ? body.active : current.active, updatedAt: new Date() }).where(eq(reportRecipients.id, id)).returning();
    return NextResponse.json({ recipient: updated });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid recipient' }, { status: 400 }); }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { assertCsrf(request); } catch (error) { if (error instanceof CsrfError) return NextResponse.json({ error: 'Cross-origin request blocked' }, { status: 403 }); throw error; }
  const session = await getSession(); if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Admins only' }, { status: 403 });
  const id = Number((await params).id);
  const [recipient] = await db.select().from(reportRecipients).where(eq(reportRecipients.id, id)).limit(1);
  if (!recipient) return NextResponse.json({ error: 'Recipient not found' }, { status: 404 });
  if (recipient.collegeId !== session.user.collegeId) return NextResponse.json({ error: 'Report recipients can only be managed within your college' }, { status: 403 });
  await db.update(reportRecipients).set({ active: false, updatedAt: new Date() }).where(eq(reportRecipients.id, id));
  return NextResponse.json({ message: 'Recipient disabled' });
}
