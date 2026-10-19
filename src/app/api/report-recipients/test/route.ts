import { NextRequest, NextResponse } from 'next/server';
import { readJsonBody } from '@/lib/requestBody';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { reportRecipients, reportSettings } from '@/db/schema';
import { getSession } from '@/lib/auth-jwt';
import { assertCsrf, CsrfError } from '@/lib/csrf';
import { generateMonthlyReport } from '@/lib/monthlyReport';
import { sendReportEmail } from '@/lib/reportMailer';

export async function POST(request: NextRequest) {
  try { assertCsrf(request); } catch (error) { if (error instanceof CsrfError) return NextResponse.json({ error: 'Cross-origin request blocked' }, { status: 403 }); throw error; }
  const session = await getSession(); if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Admins only' }, { status: 403 });
  try {
    const parsedBody = await readJsonBody(request); if (!parsedBody.ok) return parsedBody.response;
    const body = parsedBody.data as Record<string, any>; const [recipient] = await db.select().from(reportRecipients).where(eq(reportRecipients.id, Number(body.recipientId))).limit(1);
    if (!recipient || !recipient.active) return NextResponse.json({ error: 'Choose an active recipient' }, { status: 404 });
    if (recipient.collegeId !== session.user.collegeId) return NextResponse.json({ error: 'Report recipients can only be managed within your college' }, { status: 403 });
    const [setting] = await db.select().from(reportSettings).where(eq(reportSettings.collegeId, recipient.collegeId)).limit(1);
    const timezone = setting?.timezone || 'Asia/Kolkata';
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit' }).format(new Date());
    const report = await generateMonthlyReport({ collegeId: recipient.collegeId, labIds: recipient.labIds, period: date, timezone });
    await sendReportEmail({ to: recipient.email, name: recipient.displayName, period: date, summary: `Test delivery. Report covers ${report.summary.labs.join(', ')}.`, buffer: report.buffer, test: true });
    return NextResponse.json({ message: `Test report sent to ${recipient.email}` });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Email send failed' }, { status: 502 }); }
}
