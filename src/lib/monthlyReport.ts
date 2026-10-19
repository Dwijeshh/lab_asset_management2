import * as XLSX from 'xlsx';
import { and, eq, gte, inArray, isNull, lt } from 'drizzle-orm';
import { db } from '@/db';
import { assets, assetTypeFields, assetTypes, auditLogs, labs, users } from '@/db/schema';
import { safeCellString } from '@/lib/importAssets';

export type MonthlyReport = { buffer: Buffer; summary: { month: string; timezone: string; generatedAt: string; labs: string[]; added: number; updated: number; removed: number; currentAssets: number; labSummaries: { name: string; currentAssets: number; added: number; updated: number; removed: number }[] } };

function localParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

export function monthBoundsUtc(period: string, timezone: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) throw new Error('month must use YYYY-MM format');
  const year = Number(match[1]); const month = Number(match[2]);
  if (month < 1 || month > 12) throw new Error('Invalid month');
  const localToUtc = (y: number, m: number) => {
    const wanted = Date.UTC(y, m - 1, 1, 0, 0, 0);
    let candidate = wanted;
    for (let i = 0; i < 3; i++) {
      const parts = localParts(new Date(candidate), timezone);
      const observed = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
      candidate += wanted - observed;
    }
    return new Date(candidate);
  };
  return { start: localToUtc(year, month), end: localToUtc(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1) };
}

function sheet(rows: unknown[][]) {
  return XLSX.utils.aoa_to_sheet(rows.map((row) => row.map(safeCellString)));
}

export async function generateMonthlyReport(params: { collegeId: number; labIds: number[]; period: string; timezone: string }): Promise<MonthlyReport> {
  const { start, end } = monthBoundsUtc(params.period, params.timezone);
  const selectedLabs = await db.select().from(labs).where(and(eq(labs.collegeId, params.collegeId), inArray(labs.id, params.labIds)));
  const labIds = selectedLabs.map((lab) => lab.id);
  if (!labIds.length) throw new Error('Select at least one permitted lab');
  if (labIds.length !== new Set(params.labIds).size) throw new Error('A selected lab is outside the college');
  const generatedAt = new Date();
  const inventory = await db.select({ asset: assets, assetTypeName: assetTypes.name, labName: labs.name }).from(assets).innerJoin(labs, eq(assets.labId, labs.id)).leftJoin(assetTypes, eq(assets.assetTypeId, assetTypes.id))
    .where(and(eq(assets.collegeId, params.collegeId), inArray(assets.labId, labIds), isNull(assets.removedAt)));
  const reportAssets = await db.select({ asset: assets }).from(assets).where(and(eq(assets.collegeId, params.collegeId), inArray(assets.labId, labIds)));
  const createdActivity = await db.select({ audit: auditLogs, actorName: users.name }).from(auditLogs).leftJoin(users, eq(auditLogs.userId, users.id))
    .where(and(eq(auditLogs.entityType, 'asset'), eq(auditLogs.action, 'CREATE'), gte(auditLogs.createdAt, start), lt(auditLogs.createdAt, end)));
  const activity = await db.select({ audit: auditLogs, actorName: users.name }).from(auditLogs).leftJoin(users, eq(auditLogs.userId, users.id))
    .where(and(eq(auditLogs.entityType, 'asset'), inArray(auditLogs.action, ['UPDATE', 'DELETE']), gte(auditLogs.createdAt, start), lt(auditLogs.createdAt, end)));
  const labById = new Map(selectedLabs.map((lab) => [lab.id, lab.name]));
  const assetById = new Map(reportAssets.map((item) => [item.asset.id, item.asset]));
  const historicalNames = new Map<number, string>();
  for (const { audit } of createdActivity) {
    try {
      const changes = audit.changes ? JSON.parse(audit.changes) : {};
      if (typeof changes.name === 'string') historicalNames.set(audit.entityId, changes.name);
    } catch { /* Old audit rows can be incomplete. */ }
  }
  const typeIds = [...new Set(reportAssets.map((item) => item.asset.assetTypeId).filter((id): id is number => id !== null))];
  const assetTypeRows = typeIds.length ? await db.select({ id: assetTypes.id, name: assetTypes.name }).from(assetTypes).where(inArray(assetTypes.id, typeIds)) : [];
  const assetTypeNames = new Map(assetTypeRows.map((type) => [type.id, type.name]));
  const fieldDefinitions = typeIds.length ? await db.select().from(assetTypeFields).where(inArray(assetTypeFields.assetTypeId, typeIds)) : [];
  const customLabels = new Map(fieldDefinitions.map((field) => [field.fieldKey, field.label]));
  const readableCustom = (values: unknown) => {
    const parsed = values && typeof values === 'object' && !Array.isArray(values) ? values as Record<string, unknown> : {};
    return JSON.stringify(Object.fromEntries(Object.entries(parsed).map(([key, value]) => [customLabels.get(key) || key, value])));
  };
  const updates: unknown[][] = [];
  const removals: unknown[][] = [];
  for (const entry of activity) {
    let diff: Record<string, any> = {};
    try { diff = entry.audit.changes ? JSON.parse(entry.audit.changes) : {}; } catch { diff = {}; }
    const snapshotLab = Number(diff.labId?.to ?? diff.labId ?? diff.from?.labId ?? 0);
    const asset = assetById.get(entry.audit.entityId);
    const oldLabId = Number(diff.labId?.from || 0);
    const eventLabIds = entry.audit.action === 'UPDATE' && oldLabId && oldLabId !== snapshotLab
      ? [...new Set([oldLabId, snapshotLab])]
      : [asset?.labId ?? snapshotLab];
    const visibleLabIds = eventLabIds.filter((labId) => labIds.includes(labId));
    if (!visibleLabIds.length) continue;
    const time = entry.audit.createdAt.toISOString();
    if (entry.audit.action === 'DELETE') {
      const labId = visibleLabIds[0];
      removals.push([asset?.name ?? diff.name ?? `Asset #${entry.audit.entityId}`, labById.get(labId) || `Lab #${labId}`, diff.removalReason || asset?.removalReason || 'Removal reason not captured', entry.actorName || 'Unknown', time]);
    } else {
      const changes = Object.entries(diff).filter(([key]) => !['unchanged', 'collegeId', 'labId'].includes(key)).map(([key, value]) => key === 'customFields'
        ? `Custom fields: ${readableCustom(value.from)} → ${readableCustom(value.to)}`
        : `${key}: ${JSON.stringify(value.from)} → ${JSON.stringify(value.to)}`).join('; ');
      for (const labId of visibleLabIds) updates.push([diff.name?.to ?? asset?.name ?? historicalNames.get(entry.audit.entityId) ?? `Asset #${entry.audit.entityId}`, labById.get(labId) || `Lab #${labId}`, changes || 'Update (field details unavailable)', entry.actorName || 'Unknown', time]);
    }
  }
  const addedRows = createdActivity.flatMap(({ audit, actorName }) => {
    let diff: Record<string, any> = {};
    try { diff = audit.changes ? JSON.parse(audit.changes) : {}; } catch { diff = {}; }
    const asset = assetById.get(audit.entityId);
    const labId = Number(diff.labId || asset?.labId || 0);
    if (!labIds.includes(labId)) return [];
    return [[diff.name || asset?.name || `Asset #${audit.entityId}`, labById.get(labId) || `Lab #${labId}`, assetTypeNames.get(Number(diff.assetTypeId ?? asset?.assetTypeId)) || '', diff.category || asset?.category || 'Unknown', diff.manufacturer ?? asset?.manufacturer ?? '', diff.model ?? asset?.model ?? '', diff.serialNumber ?? asset?.serialNumber ?? '', diff.location ?? asset?.location ?? '', diff.status ?? asset?.status ?? '', diff.purchaseDate ?? asset?.purchaseDate?.toISOString() ?? '', diff.warrantyExpiry ?? asset?.warrantyExpiry?.toISOString() ?? '', diff.notes ?? asset?.notes ?? '', actorName || 'Unknown', audit.createdAt.toISOString(), readableCustom(diff.customFields ?? asset?.customFields)]];
  });
  const invRows = inventory.map(({ asset, assetTypeName, labName }) => [asset.name, labName, assetTypeName || '', asset.category, asset.manufacturer || '', asset.model || '', asset.serialNumber || '', asset.location, asset.status, asset.purchaseDate?.toISOString() || '', asset.warrantyExpiry?.toISOString() || '', asset.notes || '', readableCustom(asset.customFields)]);
  const summaries = selectedLabs.map((lab) => [lab.name, addedRows.filter((row) => row[1] === lab.name).length, updates.filter((row) => row[1] === lab.name).length, removals.filter((row) => row[1] === lab.name).length]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet([['Reporting month', params.period], ['Timezone', params.timezone], ['Generated at', generatedAt.toISOString()], ['Current inventory as of', generatedAt.toISOString()], ['Historical note', 'Current inventory is not month-end historical inventory. Older audit records may not contain complete before/after values.'], ['Labs', ...selectedLabs.map((lab) => lab.name)], [], ['Lab', 'Added', 'Updated', 'Removed'], ...summaries]), 'Summary');
  XLSX.utils.book_append_sheet(workbook, sheet([['Asset', 'Lab', 'Asset type', 'Legacy category', 'Manufacturer', 'Model', 'Serial number', 'Location', 'Status', 'Purchase date', 'Warranty expiry', 'Notes', 'Custom fields'], ...invRows]), 'Current inventory');
  XLSX.utils.book_append_sheet(workbook, sheet([['Asset', 'Lab', 'Asset type', 'Legacy category', 'Manufacturer', 'Model', 'Serial number', 'Location', 'Status', 'Purchase date', 'Warranty expiry', 'Notes', 'Added by', 'Added at', 'Custom fields'], ...addedRows]), 'Added');
  XLSX.utils.book_append_sheet(workbook, sheet([['Asset', 'Lab', 'Changes', 'Changed by', 'Changed at'], ...updates]), 'Updated');
  XLSX.utils.book_append_sheet(workbook, sheet([['Asset', 'Lab', 'Removal reason', 'Removed by', 'Removed at'], ...removals]), 'Removed');
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  const labSummaries = selectedLabs.map((lab) => ({
    name: lab.name,
    currentAssets: inventory.filter((row) => row.asset.labId === lab.id).length,
    added: addedRows.filter((row) => row[1] === lab.name).length,
    updated: updates.filter((row) => row[1] === lab.name).length,
    removed: removals.filter((row) => row[1] === lab.name).length,
  }));
  return { buffer, summary: { month: params.period, timezone: params.timezone, generatedAt: generatedAt.toISOString(), labs: selectedLabs.map((lab) => lab.name), added: addedRows.length, updated: updates.length, removed: removals.length, currentAssets: inventory.length, labSummaries } };
}
