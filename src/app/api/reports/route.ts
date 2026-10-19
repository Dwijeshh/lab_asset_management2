import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-jwt';
import { generateMonthlyReport } from '@/lib/monthlyReport';
import { resolveReportScope } from '@/lib/reportAccess';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let scope;
  try { scope = await resolveReportScope(session.user, request.nextUrl.searchParams); }
  catch (error) { const message = error instanceof Error ? error.message : ''; return NextResponse.json({ error: message === 'FORBIDDEN' ? 'Forbidden' : message }, { status: message === 'FORBIDDEN' ? 403 : 400 }); }
  try {
    const month = request.nextUrl.searchParams.get('month') || '';
    const report = await generateMonthlyReport({ ...scope, period: month });
    return NextResponse.json({ summary: report.summary });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not generate report' }, { status: 400 }); }
}
