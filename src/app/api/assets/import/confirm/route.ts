import { and, eq, isNull, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { readJsonBody } from '@/lib/requestBody';
import { db } from '@/db';
import { assets, assetTypeFields, assetTypes, importBatches, labs } from '@/db/schema';
import { assertCsrf, CsrfError } from '@/lib/csrf';
import { canAccessCollege, canManageLab, getSession } from '@/lib/auth-jwt';
import { logAudit } from '@/lib/audit';
import { notifyAssetImport } from '@/lib/notify';
import { validateCustomFieldValues } from '@/lib/customFields';
import { validateAssetInput } from '@/lib/validation';
import { getClientIdentifier, rateLimit, RateLimitError } from '@/lib/rateLimit';

type PreviewRow = { rowNumber: number; valid: boolean; duplicate: boolean; error: string | null; asset: Record<string, any> | null };
export async function POST(request: NextRequest) {
  try { assertCsrf(request); } catch (error) { if (error instanceof CsrfError) return NextResponse.json({ error: 'Cross-origin request blocked' }, { status: 403 }); throw error; }
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role === 'technician') return NextResponse.json({ error: 'You cannot import assets' }, { status: 403 });
  try {
    const clientId = getClientIdentifier(request);
    await rateLimit(`assets:import-confirm:${clientId}`, { windowMs: 60000, maxRequests: 10 });
    const parsedBody = await readJsonBody(request);
    if (!parsedBody.ok) return parsedBody.response;
    const body = parsedBody.data as Record<string, any>;
    if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'Request body must be an object' }, { status: 400 });
    if (body.confirm !== true || typeof body.token !== 'string') return NextResponse.json({ error: 'Confirm the valid rows explicitly' }, { status: 400 });
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('lab-asset-import-serials'))`);
      const [batch] = await tx.select().from(importBatches).where(eq(importBatches.token, body.token)).for('update').limit(1);
      if (!batch || batch.userId !== session.user.id) return { status: 404 as const, error: 'Import preview not found' };
      if (batch.expiresAt < new Date()) return { status: 410 as const, error: 'Import preview expired; upload the file again' };
      const [lab] = await tx.select().from(labs).where(eq(labs.id, batch.labId)).limit(1);
      if (!lab || lab.collegeId !== batch.collegeId || !canAccessCollege(session.user, lab.collegeId) || !(await canManageLab(session.user, lab.id))) return { status: 403 as const, error: 'You are not assigned to this lab' };
      const [type] = batch.assetTypeId ? await tx.select().from(assetTypes).where(and(eq(assetTypes.id, batch.assetTypeId), eq(assetTypes.collegeId, lab.collegeId))).limit(1) : [];
      if (!type) return { status: 409 as const, error: 'The selected asset type is no longer available' };
      if (batch.status === 'imported') return { status: 200 as const, already: true, imported: (batch.rows as PreviewRow[]).filter((row) => row.valid).length, skipped: (batch.rows as PreviewRow[]).filter((row) => !row.valid).length, failed: 0, batchId: batch.id, labId: batch.labId };
      const definitions = await tx.select().from(assetTypeFields).where(eq(assetTypeFields.assetTypeId, type.id));
      const rows = batch.rows as PreviewRow[];
      const eligible = rows.filter((row) => row.valid && row.asset);
      for (const row of eligible) {
        try {
          const checked = validateAssetInput(row.asset);
          const customFields = validateCustomFieldValues(definitions, row.asset?.customFields || {});
          row.asset = { ...row.asset, ...checked, customFields };
        } catch (error) {
          row.valid = false; row.error = error instanceof Error ? error.message : 'Row validation failed';
        }
      }
      const serials = eligible.map((row) => row.asset?.serialNumber).filter((value): value is string => typeof value === 'string' && value.length > 0);
      const stored = serials.length ? await tx.select({ serialNumber: assets.serialNumber }).from(assets).where(and(eq(assets.labId, lab.id), isNull(assets.removedAt))) : [];
      const existing = new Set(stored.map((row) => row.serialNumber?.trim().toLocaleLowerCase()).filter(Boolean));
      const fileSerials = new Set<string>();
      const toInsert: PreviewRow[] = [];
      for (const row of eligible) {
        const serial = row.asset?.serialNumber?.trim().toLocaleLowerCase();
        if (serial && (existing.has(serial) || fileSerials.has(serial))) {
          row.valid = false; row.duplicate = true; row.error = 'Serial number already exists in the destination lab';
        } else {
          if (serial) fileSerials.add(serial);
          toInsert.push(row);
        }
      }
      const imported = toInsert.length;
      const assetRecords: { id: number; name: string; category: string; manufacturer: string | null; model: string | null; serialNumber: string | null; location: string; status: string; purchaseDate: Date | null; warrantyExpiry: Date | null; notes: string | null; customFields: Record<string, unknown>; assetTypeId: number | null; collegeId: number | null; labId: number }[] = [];
      for (const row of toInsert) {
        const value = row.asset!;
        const [inserted] = await tx.insert(assets).values({
          name: String(value.name), category: value.category, manufacturer: value.manufacturer ?? null,
          model: value.model ?? null, serialNumber: value.serialNumber ?? null, location: String(value.location),
          status: value.status, purchaseDate: value.purchaseDate ? new Date(value.purchaseDate) : null,
          warrantyExpiry: value.warrantyExpiry ? new Date(value.warrantyExpiry) : null, notes: value.notes ?? null,
          customFields: value.customFields || {}, collegeId: lab.collegeId, labId: lab.id, assetTypeId: batch.assetTypeId,
          createdById: session.user.id, updatedById: session.user.id,
        }).returning({ id: assets.id, name: assets.name, category: assets.category, manufacturer: assets.manufacturer, model: assets.model, serialNumber: assets.serialNumber, location: assets.location, status: assets.status, purchaseDate: assets.purchaseDate, warrantyExpiry: assets.warrantyExpiry, notes: assets.notes, customFields: assets.customFields, assetTypeId: assets.assetTypeId, collegeId: assets.collegeId, labId: assets.labId });
        assetRecords.push(inserted);
      }
      await tx.update(importBatches).set({ status: 'imported', rows }).where(eq(importBatches.id, batch.id));
      return { status: 200 as const, already: false, imported, skipped: rows.length - imported, failed: 0, batchId: batch.id, labId: batch.labId, assetRecords };
    });
    if (result.status !== 200) return NextResponse.json({ error: result.error }, { status: result.status });
    if (!result.already) {
      await Promise.all((result.assetRecords || []).map((asset) => logAudit({ userId: session.user.id, action: 'CREATE', entityType: 'asset', entityId: asset.id, changes: { ...asset, importBatchId: result.batchId } })));
      await logAudit({ userId: session.user.id, action: 'IMPORT', entityType: 'asset_import_batch', entityId: result.batchId, changes: { imported: result.imported, skipped: result.skipped, failed: result.failed, labId: result.labId } });
      if (result.imported) await notifyAssetImport({ assetCount: result.imported, labId: result.labId, actor: { id: session.user.id, name: session.user.name } });
    }
    return NextResponse.json({ imported: result.imported, skipped: result.skipped, failed: result.failed, batchId: result.batchId, alreadyImported: result.already });
  } catch (error) {
    if (error instanceof RateLimitError) return NextResponse.json({ error: 'Rate limit exceeded', retryAfter: error.retryAfter }, { status: 429, headers: { 'Retry-After': error.retryAfter.toString() } });
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Import confirmation failed' }, { status: 500 });
  }
}
