import { NextRequest, NextResponse } from 'next/server';
import { readJsonBody } from '@/lib/requestBody';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { reportRecipients, reportSettings } from '@/db/schema';
import { getSession } from '@/lib/auth-jwt';
import { assertCsrf, CsrfError } from '@/lib/csrf';

export async function PUT(request: NextRequest) {
  try { assertCsrf(request); } catch (error) { if (error instanceof CsrfError) return NextResponse.json({ error: 'Cross-origin request blocked' }, { status: 403 }); throw error; }
  const session = await getSession(); if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Admins only' }, { status: 403 });
  try {
    const parsedBody = await readJsonBody(request); if (!parsedBody.ok) return parsedBody.response;
    const body = parsedBody.data as Record<string, any>; const collegeId = Number(body.collegeId ?? session.user.collegeId);
    if (collegeId !== session.user.collegeId) return NextResponse.json({ error: 'Report scheduling can only be configured within your college' }, { status: 403 });
    if (typeof body.enabled !== 'boolean') return NextResponse.json({ error: 'enabled must be boolean' }, { status: 400 });
    if (body.enabled) {
      const [recipient] = await db.select({ id: reportRecipients.id }).from(reportRecipients).where(and(eq(reportRecipients.collegeId, collegeId), eq(reportRecipients.active, true))).limit(1);
      if (!recipient) return NextResponse.json({ error: 'Add at least one active report recipient before enabling delivery' }, { status: 400 });
    }
    const timezone = typeof body.timezone === 'string' ? body.timezone.trim() : 'Asia/Kolkata';
    new Intl.DateTimeFormat('en', { timeZone: timezone });
    const [row] = await db.insert(reportSettings).values({ collegeId, enabled: body.enabled, timezone, updatedById: session.user.id }).onConflictDoUpdate({ target: reportSettings.collegeId, set: { enabled: body.enabled, timezone, updatedById: session.user.id, updatedAt: new Date() } }).returning();
    return NextResponse.json({ settings: row });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid reporting settings' }, { status: 400 }); }
}
