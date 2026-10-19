import { randomUUID } from 'crypto';
import { and, eq, isNull } from 'drizzle-orm';
import * as XLSX from 'xlsx';
import { NextRequest, NextResponse } from 'next/server';
import { readImportFormData } from '@/lib/requestBody';
import { getClientIdentifier, rateLimit, RateLimitError } from '@/lib/rateLimit';
import { db } from '@/db';
import { assetTypeFields, assetTypes, assets, importBatches, labs } from '@/db/schema';
import { assertCsrf, CsrfError } from '@/lib/csrf';
import { canAccessCollege, canManageLab, getSession } from '@/lib/auth-jwt';
import { IMPORT_TARGETS, MAX_IMPORT_BYTES, MAX_IMPORT_ROWS, normalizeImportRows, parseImportWorkbook, safeCellString, workbookRows } from '@/lib/importAssets';
import { ValidationError } from '@/lib/validation';

export async function POST(request: NextRequest) {
  try { assertCsrf(request); } catch (error) { if (error instanceof CsrfError) return NextResponse.json({ error: 'Cross-origin request blocked' }, { status: 403 }); throw error; }
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role === 'technician') return NextResponse.json({ error: 'You cannot import assets' }, { status: 403 });
  try {
    const clientId = getClientIdentifier(request);
    await rateLimit(`assets:import:${clientId}`, { windowMs: 60000, maxRequests: 5 });
    const parsedForm = await readImportFormData(request);
    if (!parsedForm.ok) return parsedForm.response;
    const form = parsedForm.data;
    const file = form.get('file');
    const labId = Number(form.get('labId'));
    const assetTypeId = Number(form.get('assetTypeId'));
    if (!(file instanceof File)) return NextResponse.json({ error: 'Choose an .xlsx or .csv file' }, { status: 400 });
    if (file.size > MAX_IMPORT_BYTES) return NextResponse.json({ error: 'File exceeds the 8 MB limit' }, { status: 413 });
    const [lab] = await db.select().from(labs).where(eq(labs.id, labId)).limit(1);
    if (!lab || !canAccessCollege(session.user, lab.collegeId)) return NextResponse.json({ error: 'Lab not found in your college' }, { status: 404 });
    if (!(await canManageLab(session.user, labId))) return NextResponse.json({ error: 'You are not assigned to this lab' }, { status: 403 });
    const [type] = await db.select().from(assetTypes).where(and(eq(assetTypes.id, assetTypeId), eq(assetTypes.collegeId, lab.collegeId))).limit(1);
    if (!type) return NextResponse.json({ error: 'Select an asset type for this lab' }, { status: 400 });
    const extension = file.name.toLowerCase().endsWith('.csv') ? '.csv' : file.name.toLowerCase().endsWith('.xlsx') ? '.xlsx' : '';
    const workbook = parseImportWorkbook(Buffer.from(await file.arrayBuffer()), extension);
    const sheetNames = workbook.SheetNames;
    const requestedSheet = form.get('sheetName');
    if (requestedSheet === null && sheetNames.length > 1) return NextResponse.json({ sheetNames, inspectOnly: true });
    const sheetName = String(requestedSheet || sheetNames[0] || '');
    if (!sheetNames.includes(sheetName)) return NextResponse.json({ error: 'Selected worksheet was not found', sheetNames }, { status: 400 });
    const rawRows = workbookRows(workbook.Sheets[sheetName]);
    if (!rawRows.length) return NextResponse.json({ error: 'The selected worksheet is empty', sheetNames }, { status: 400 });
    if (rawRows.length > MAX_IMPORT_ROWS) return NextResponse.json({ error: `The selected sheet exceeds the ${MAX_IMPORT_ROWS} row limit` }, { status: 400 });
    const headers = Object.keys(rawRows[0]);
    const definitions = await db.select().from(assetTypeFields).where(eq(assetTypeFields.assetTypeId, type.id)).orderBy(assetTypeFields.displayOrder);
    const targets = [...IMPORT_TARGETS, ...definitions.map((field) => `custom:${field.fieldKey}`)];
    const mapping: Record<string, string> = {};
    for (const target of targets) {
      const guessed = headers.find((header) => header.trim().toLowerCase() === target.replace('custom:', '').toLowerCase());
      if (guessed) mapping[target] = guessed;
    }
    const submittedMapping = form.get('mapping');
    if (typeof submittedMapping === 'string') Object.assign(mapping, JSON.parse(submittedMapping));
    for (const column of Object.values(mapping)) if (!headers.includes(column)) throw new ValidationError('Column mapping refers to a missing worksheet column');
    const results = normalizeImportRows(rawRows, mapping, type, definitions);
    const serials = results.filter((row) => row.valid && row.asset?.serialNumber).map((row) => row.asset!.serialNumber as string);
    const existingSerials = serials.length ? await db.select({ serialNumber: assets.serialNumber }).from(assets).where(and(eq(assets.labId, labId), isNull(assets.removedAt))) : [];
    const existing = new Set(existingSerials.map((row) => row.serialNumber?.trim().toLocaleLowerCase()).filter(Boolean));
    for (const result of results) if (result.valid && result.asset?.serialNumber && existing.has(result.asset.serialNumber.toLocaleLowerCase())) {
      result.valid = false; result.duplicate = true; result.error = 'Serial number already exists in the destination lab';
    }
    const token = randomUUID();
    const persisted = results.map(({ rowNumber, valid, duplicate, error, asset }) => ({ rowNumber, valid, duplicate, error, asset }));
    await db.insert(importBatches).values({ token, userId: session.user.id, collegeId: lab.collegeId, labId, assetTypeId: type.id, rows: persisted, expiresAt: new Date(Date.now() + 30 * 60_000) });
    return NextResponse.json({ token, sheetNames, sheetName, headers, targets, mapping, rows: results, limits: { maxBytes: MAX_IMPORT_BYTES, maxRows: MAX_IMPORT_ROWS } });
  } catch (error) {
    if (error instanceof RateLimitError) return NextResponse.json({ error: 'Rate limit exceeded', retryAfter: error.retryAfter }, { status: 429, headers: { 'Retry-After': error.retryAfter.toString() } });
    if (error instanceof ValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not parse import file' }, { status: 400 });
  }
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role === 'technician') return NextResponse.json({ error: 'You cannot import assets' }, { status: 403 });
  const typeId = Number(request.nextUrl.searchParams.get('assetTypeId'));
  const [type] = await db.select().from(assetTypes).where(and(eq(assetTypes.id, typeId), eq(assetTypes.collegeId, session.user.collegeId))).limit(1);
  if (!type) return NextResponse.json({ error: 'Asset type not found' }, { status: 404 });
  const fields = await db.select().from(assetTypeFields).where(eq(assetTypeFields.assetTypeId, typeId)).orderBy(assetTypeFields.displayOrder);
  const headers = ['name', 'manufacturer', 'model', 'serialNumber', 'location', 'category', 'status', 'purchaseDate', 'warrantyExpiry', 'notes', ...fields.map((field) => field.fieldKey)];
  const worksheet = XLSX.utils.aoa_to_sheet([headers.map(safeCellString)]);
  const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, worksheet, 'Assets');
  const content = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  return new Response(new Uint8Array(content), { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${type.name.replace(/[^a-z0-9-]/gi, '_')}-template.xlsx"` } });
}
