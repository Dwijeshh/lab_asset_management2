import { timingSafeEqual } from 'crypto';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { colleges, labs, reportDeliveries, reportRecipients, reportSettings } from '@/db/schema';
import { generateMonthlyReport } from '@/lib/monthlyReport';
import { sendReportEmail } from '@/lib/reportMailer';

function authorized(request: NextRequest) {
  const expected = process.env.REPORT_SCHEDULER_SECRET || process.env.CRON_SECRET;
  const provided = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  if (!expected || !provided) return false;
  const a = Buffer.from(expected); const b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a, b);
}
function dateParts(timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

async function run(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized scheduler request' }, { status: 401 });
  const configured = await db.select().from(reportSettings).where(eq(reportSettings.enabled, true));
  const results: { collegeId: number; period?: string; sent?: number; failed?: number; skipped?: number; error?: string }[] = [];
  for (const setting of configured) {
    const local = dateParts(setting.timezone);
    const year = Number(local.year); const month = Number(local.month);
    const previous = new Date(Date.UTC(year, month - 2, 1));
    const period = `${previous.getUTCFullYear()}-${String(previous.getUTCMonth() + 1).padStart(2, '0')}`;
    const recipients = await db.select().from(reportRecipients).where(and(eq(reportRecipients.collegeId, setting.collegeId), eq(reportRecipients.active, true)));
    let sent = 0; let failed = 0; let skipped = 0;
    for (const recipient of recipients) {
      const selectedLabs = Array.isArray(recipient.labIds) ? recipient.labIds : [];
      const validLabs = selectedLabs.length ? await db.select({ id: labs.id }).from(labs).where(and(eq(labs.collegeId, setting.collegeId), inArray(labs.id, selectedLabs))) : [];
      if (!selectedLabs.length || validLabs.length !== selectedLabs.length) { failed++; continue; }
      const pendingDeliveries = await db.select({ period: reportDeliveries.period }).from(reportDeliveries)
        .where(and(eq(reportDeliveries.recipientId, recipient.id), inArray(reportDeliveries.status, ['pending', 'failed', 'sending'])))
        .orderBy(desc(reportDeliveries.period));
      const periods = [...new Set([...(local.day === '01' ? [period] : []), ...pendingDeliveries.map((delivery) => delivery.period)])];
      if (!periods.length) { skipped++; continue; }
      for (const deliveryPeriod of periods) {
      try {
        if (deliveryPeriod === period && local.day === '01') await db.insert(reportDeliveries).values({ recipientId: recipient.id, period: deliveryPeriod, status: 'pending' }).onConflictDoNothing({ target: [reportDeliveries.recipientId, reportDeliveries.period] });
        const claim = await db.transaction(async (tx) => {
          const [delivery] = await tx.select().from(reportDeliveries).where(and(eq(reportDeliveries.recipientId, recipient.id), eq(reportDeliveries.period, deliveryPeriod))).for('update').limit(1);
          if (!delivery || delivery.status === 'sent') return null;
          if (delivery.status === 'sending' && delivery.startedAt && Date.now() - delivery.startedAt.getTime() < 45 * 60_000) return null;
          await tx.update(reportDeliveries).set({ status: 'sending', attempts: delivery.attempts + 1, startedAt: new Date(), lastError: null }).where(eq(reportDeliveries.id, delivery.id));
          return delivery.id;
        });
        if (!claim) { skipped++; continue; }
        try {
          const report = await generateMonthlyReport({ collegeId: setting.collegeId, labIds: selectedLabs, period: deliveryPeriod, timezone: setting.timezone });
          await sendReportEmail({ to: recipient.email, name: recipient.displayName, period: deliveryPeriod, summary: `Monthly summary: ${report.summary.added} added, ${report.summary.updated} updated, ${report.summary.removed} removed. Labs: ${report.summary.labs.join(', ')}.`, buffer: report.buffer });
          await db.update(reportDeliveries).set({ status: 'sent', completedAt: new Date(), lastError: null }).where(eq(reportDeliveries.id, claim));
          sent++;
        } catch (error) {
          const message = error instanceof Error ? error.message.slice(0, 4000) : 'Delivery failed';
          await db.update(reportDeliveries).set({ status: 'failed', completedAt: new Date(), lastError: message }).where(eq(reportDeliveries.id, claim));
          failed++;
        }
      } catch (error) { failed++; }
      }
    }
    results.push({ collegeId: setting.collegeId, period, sent, failed, skipped });
  }
  return NextResponse.json({ results });
}

export async function GET(request: NextRequest) { return run(request); }
export async function POST(request: NextRequest) { return run(request); }
