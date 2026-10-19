import { NextRequest, NextResponse } from 'next/server';
import { readJsonBody } from '@/lib/requestBody';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { labs, reportRecipients, reportSettings } from '@/db/schema';
import { getSession } from '@/lib/auth-jwt';
import { assertCsrf, CsrfError } from '@/lib/csrf';
import { validateEmail } from '@/lib/validation';

function adminOnly(role: string) { return role === 'admin'; }
export async function GET(request: NextRequest) {
  const session = await getSession(); if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!adminOnly(session.user.role)) return NextResponse.json({ error: 'Admins only' }, { status: 403 });
  const collegeId = Number(request.nextUrl.searchParams.get('collegeId') || session.user.collegeId);
  if (collegeId !== session.user.collegeId) return NextResponse.json({ error: 'Report recipients can only be managed within your college' }, { status: 403 });
  const [settings] = await db.select().from(reportSettings).where(eq(reportSettings.collegeId, collegeId)).limit(1);
  const recipients = await db.select().from(reportRecipients).where(eq(reportRecipients.collegeId, collegeId));
  return NextResponse.json({ settings: settings || { collegeId, enabled: false, timezone: process.env.INSTITUTION_TIMEZONE || 'Asia/Kolkata' }, recipients });
}

export async function POST(request: NextRequest) {
  try { assertCsrf(request); } catch (error) { if (error instanceof CsrfError) return NextResponse.json({ error: 'Cross-origin request blocked' }, { status: 403 }); throw error; }
  const session = await getSession(); if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!adminOnly(session.user.role)) return NextResponse.json({ error: 'Admins only' }, { status: 403 });
  try {
    const parsedBody = await readJsonBody(request); if (!parsedBody.ok) return parsedBody.response;
    const body = parsedBody.data as Record<string, any>; const collegeId = Number(body.collegeId ?? session.user.collegeId);
    const email = validateEmail(body.email); const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
    if (collegeId !== session.user.collegeId) return NextResponse.json({ error: 'Report recipients can only be managed within your college' }, { status: 403 });
    const labIds: number[] = Array.isArray(body.labIds) ? [...new Set<number>((body.labIds as unknown[]).map((value) => Number(value)))] : [];
    if (!displayName || !labIds.length || labIds.some((id) => !Number.isInteger(id) || id <= 0)) return NextResponse.json({ error: 'Name and at least one lab are required' }, { status: 400 });
    const scopedLabs = await db.select({ id: labs.id }).from(labs).where(and(eq(labs.collegeId, collegeId), inArray(labs.id, labIds)));
    if (scopedLabs.length !== labIds.length) return NextResponse.json({ error: 'Every selected lab must belong to the same college' }, { status: 400 });
    const [recipient] = await db.insert(reportRecipients).values({ collegeId, email, displayName, labIds, active: body.active !== false, createdById: session.user.id }).returning();
    return NextResponse.json({ recipient }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid recipient' }, { status: 400 }); }
}
