import { NextRequest, NextResponse } from 'next/server';
import { and, asc, eq, ilike, or } from 'drizzle-orm';
import { db } from '@/db';
import { assets, colleges, labs } from '@/db/schema';
import { getSession, resolveCollegeFilter, canAccessCollege } from '@/lib/auth-jwt';
import { parseExportColumns } from '@/lib/asset-export';
import { makeCsv, makePdf, makePrintHtml, makeWord, makeZip, type AssetReport } from '@/lib/asset-export-files';
import { validateSearchParams } from '@/lib/validation';
import { rateLimit, getClientIdentifier, RateLimitError } from '@/lib/rateLimit';
import { logger, sanitizeError } from '@/lib/logger';

export const runtime = 'nodejs';
const MAX_EXPORT_ASSETS = 2000;
const FORMATS = ['pdf', 'docx', 'csv', 'zip', 'print'] as const;

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const clientId = getClientIdentifier(request);
    await rateLimit(`assets:export:${session.user.id}:${clientId}`, { windowMs: 60000, maxRequests: 15 });

    const searchParams = request.nextUrl.searchParams;
    const format = searchParams.get('format');
    if (!FORMATS.some(value => value === format)) {
      return NextResponse.json({ error: 'Choose PDF, Word, CSV, ZIP, or Print.' }, { status: 400 });
    }
    const columns = parseExportColumns(searchParams.get('columns'));
    if (!columns) return NextResponse.json({ error: 'Choose at least one valid asset field.' }, { status: 400 });

    let collegeFilter: number | null;
    try {
      collegeFilter = resolveCollegeFilter(session.user, searchParams.get('collegeId'));
    } catch {
      return NextResponse.json({ error: 'Invalid institution filter.' }, { status: 400 });
    }

    let labScope: string | null = null;
    const rawLabId = searchParams.get('labId');
    let labId: number | null = null;
    if (rawLabId !== null) {
      if (!/^[1-9]\d*$/.test(rawLabId)) return NextResponse.json({ error: 'Invalid laboratory.' }, { status: 400 });
      labId = Number(rawLabId);
      if (!Number.isSafeInteger(labId)) return NextResponse.json({ error: 'Invalid laboratory.' }, { status: 400 });
      const [lab] = await db.select({ name: labs.name, collegeId: labs.collegeId }).from(labs).where(eq(labs.id, labId)).limit(1);
      if (!lab || !canAccessCollege(session.user, lab.collegeId) || (collegeFilter !== null && lab.collegeId !== collegeFilter)) {
        return NextResponse.json({ error: 'Laboratory not found.' }, { status: 404 });
      }
      labScope = lab.name;
    }

    const filters = validateSearchParams(searchParams);
    const conditions = [];
    if (collegeFilter !== null) {
      conditions.push(eq(assets.collegeId, collegeFilter), eq(labs.collegeId, collegeFilter));
    }
    if (labId !== null) conditions.push(eq(assets.labId, labId));
    if (filters.search) conditions.push(or(
      ilike(assets.name, `%${filters.search}%`),
      ilike(assets.serialNumber, `%${filters.search}%`),
      ilike(assets.manufacturer, `%${filters.search}%`),
      ilike(assets.location, `%${filters.search}%`),
    )!);
    if (filters.status) conditions.push(eq(assets.status, filters.status));
    if (filters.category) conditions.push(eq(assets.category, filters.category));

    const rows = await db.select({ asset: assets, collegeName: colleges.name, labName: labs.name })
      .from(assets)
      .innerJoin(labs, eq(assets.labId, labs.id))
      .leftJoin(colleges, eq(labs.collegeId, colleges.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(colleges.name), asc(labs.name), asc(assets.name))
      .limit(MAX_EXPORT_ASSETS + 1);
    if (rows.length > MAX_EXPORT_ASSETS) {
      return NextResponse.json({ error: 'More than 2,000 assets match. Narrow the filters before exporting.' }, { status: 413 });
    }

    let scope = labScope ?? 'All MAHE institutions';
    if (!labScope && collegeFilter !== null) {
      const [college] = await db.select({ name: colleges.name }).from(colleges).where(eq(colleges.id, collegeFilter)).limit(1);
      scope = college?.name ?? 'Institution inventory';
    }
    const report: AssetReport = { title: 'Lab asset list', scope, generatedAt: new Date(), columns, rows };
    const basename = `mahe-assets-${report.generatedAt.toISOString().slice(0, 10)}`;
    const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
    if (format === 'print') {
      return new Response(makePrintHtml(report), { headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' } });
    }

    const data = format === 'pdf' ? await makePdf(report) : format === 'docx' ? await makeWord(report) : format === 'csv' ? makeCsv(report) : await makeZip(report, basename);
    const extension = format === 'docx' ? 'docx' : format === 'csv' ? 'csv' : format === 'zip' ? 'zip' : 'pdf';
    const contentType = format === 'docx'
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : format === 'csv' ? 'text/csv; charset=utf-8' : format === 'zip' ? 'application/zip' : 'application/pdf';
    return new Response(new Uint8Array(data), {
      headers: { ...headers, 'Content-Type': contentType, 'Content-Disposition': `attachment; filename="${basename}.${extension}"` },
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: 'Export rate limit exceeded. Try again shortly.' }, { status: 429, headers: { 'Retry-After': error.retryAfter.toString() } });
    }
    logger.error('Error exporting assets', { error });
    return NextResponse.json({ error: sanitizeError(error) }, { status: 500 });
  }
}
