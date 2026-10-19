import { NextRequest, NextResponse } from 'next/server';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { assetLoans, assetModificationRequests, assetRequests, assetTypeFields, assetTypes, assets, auditLogs, colleges, labs, users } from '@/db/schema';
import { getSession, canAccessCollege } from '@/lib/auth-jwt';
import { getClientIdentifier, RateLimitError, rateLimit } from '@/lib/rateLimit';
import { logger, sanitizeError } from '@/lib/logger';

type HistoryItem = { id: string; date: Date; kind: string; title: string; actor: string; details: string };

const FIELD_LABELS: Record<string, string> = {
  name: 'Name', category: 'Category', manufacturer: 'Manufacturer', model: 'Model', serialNumber: 'Serial number',
  location: 'Location', status: 'Status', purchaseDate: 'Purchase date', warrantyExpiry: 'Warranty expiry', notes: 'Notes',
  assetTypeId: 'Asset type', customFields: 'Custom fields', labId: 'Laboratory', collegeId: 'Institution',
};

function displayValue(value: unknown, labNames: Map<number, string>, collegeNames: Map<number, string>, assetTypeNames: Map<number, string>, customFieldLabels: Map<string, string>) {
  if (value === null || value === undefined || value === '') return '—';
  if (value instanceof Date) return value.toLocaleDateString();
  if (typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'string' && /^\d{4}-\d\d-\d\dT/.test(value)) return new Date(value).toLocaleDateString();
  if (typeof value === 'number') return labNames.get(value) || collegeNames.get(value) || assetTypeNames.get(value) || String(value);
  return String(value);
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await rateLimit(`asset-history:get:${getClientIdentifier(request)}`, { windowMs: 60000, maxRequests: 60 });

    const assetId = Number((await params).id);
    if (!Number.isInteger(assetId) || assetId <= 0) return NextResponse.json({ error: 'Invalid asset ID' }, { status: 400 });
    const [asset] = await db.select().from(assets).where(eq(assets.id, assetId)).limit(1);
    if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });

    // Match current asset visibility: admins can inspect all institutions,
    // technicians see only their assigned lab, and other roles stay in-college.
    if (!canAccessCollege(session.user, asset.collegeId) || (session.user.role === 'technician' && session.user.labId !== asset.labId)) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    const [auditRows, requestRows, loanRows, modificationRows] = await Promise.all([
      db.select({ audit: auditLogs, actorName: users.name }).from(auditLogs).leftJoin(users, eq(auditLogs.userId, users.id))
        .where(and(eq(auditLogs.entityType, 'asset'), eq(auditLogs.entityId, assetId))),
      db.select({ request: assetRequests }).from(assetRequests).where(eq(assetRequests.assetId, assetId)),
      db.select({ loan: assetLoans }).from(assetLoans).where(eq(assetLoans.assetId, assetId)),
      db.select({ request: assetModificationRequests }).from(assetModificationRequests).where(eq(assetModificationRequests.assetId, assetId)),
    ]);

    const actorIds = new Set<number>();
    for (const { request: row } of requestRows) { actorIds.add(row.requesterId); if (row.reviewedById) actorIds.add(row.reviewedById); }
    for (const { loan } of loanRows) { actorIds.add(loan.borrowerId); actorIds.add(loan.approverId); }
    for (const { request: row } of modificationRows) { actorIds.add(row.requestedById); if (row.reviewedById) actorIds.add(row.reviewedById); }
    if (asset.createdById) actorIds.add(asset.createdById);
    const actorRows = actorIds.size ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, [...actorIds])) : [];
    const actorNames = new Map(actorRows.map((row) => [row.id, row.name]));

    const labIds = new Set<number>([asset.labId]);
    for (const { request: row } of requestRows) labIds.add(row.requesterLabId);
    for (const { loan } of loanRows) labIds.add(loan.borrowerLabId);
    for (const { audit } of auditRows) {
      try { const changes = JSON.parse(audit.changes || '{}'); if (typeof changes.labId === 'number') labIds.add(changes.labId); if (changes.labId?.from) labIds.add(Number(changes.labId.from)); if (changes.labId?.to) labIds.add(Number(changes.labId.to)); }
      catch { /* Historical audit records may be incomplete. */ }
    }
    const labRows = labIds.size ? await db.select({ id: labs.id, name: labs.name }).from(labs).where(inArray(labs.id, [...labIds])) : [];
    const labNames = new Map(labRows.map((row) => [row.id, row.name]));
    const typeIds = new Set<number>();
    const collegeIds = new Set<number>([asset.collegeId].filter((id): id is number => id !== null));
    for (const { audit } of auditRows) {
      try {
        const changes = JSON.parse(audit.changes || '{}');
        for (const [key, value] of Object.entries(changes)) {
          if (key === 'collegeId') for (const id of [((value as any)?.from ?? value), (value as any)?.to]) if (Number.isInteger(Number(id))) collegeIds.add(Number(id));
          if (key === 'assetTypeId') for (const id of [((value as any)?.from ?? value), (value as any)?.to]) if (Number.isInteger(Number(id)) && Number(id) > 0) typeIds.add(Number(id));
        }
      } catch { /* Historical audit records may be incomplete. */ }
    }
    if (asset.assetTypeId) typeIds.add(asset.assetTypeId);
    const [collegeRows, typeRows] = await Promise.all([
      collegeIds.size ? db.select({ id: colleges.id, name: colleges.name }).from(colleges).where(inArray(colleges.id, [...collegeIds])) : Promise.resolve([]),
      typeIds.size ? db.select({ id: assetTypes.id, name: assetTypes.name }).from(assetTypes).where(inArray(assetTypes.id, [...typeIds])) : Promise.resolve([]),
    ]);
    const collegeNames = new Map(collegeRows.map((row) => [row.id, row.name]));
    const assetTypeNames = new Map(typeRows.map((row) => [row.id, row.name]));
    const typeFieldRows = typeIds.size ? await db.select({ fieldKey: assetTypeFields.fieldKey, label: assetTypeFields.label }).from(assetTypeFields).where(inArray(assetTypeFields.assetTypeId, [...typeIds])) : [];
    const customFieldLabels = new Map(typeFieldRows.map((field) => [field.fieldKey, field.label]));
    const formatCustomFields = (value: unknown) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return displayValue(value, labNames, collegeNames, assetTypeNames, customFieldLabels);
      const fields = Object.entries(value as Record<string, unknown>);
      return fields.length ? fields.map(([key, fieldValue]) => `${customFieldLabels.get(key) || key}: ${String(fieldValue ?? '—')}`).join(', ') : '—';
    };
    const formatValue = (key: string, value: unknown) => {
      if (key === 'labId' && typeof value === 'number') return labNames.get(value) || `Lab #${value}`;
      if (key === 'collegeId' && typeof value === 'number') return collegeNames.get(value) || `Institution #${value}`;
      if (key === 'assetTypeId' && typeof value === 'number') return assetTypeNames.get(value) || `Asset type #${value}`;
      if (key === 'customFields') {
        if (value && typeof value === 'object' && !Array.isArray(value) && 'from' in value && 'to' in value) {
          const change = value as { from: unknown; to: unknown };
          return `${formatCustomFields(change.from)} → ${formatCustomFields(change.to)}`;
        }
        return formatCustomFields(value);
      }
      return displayValue(value, labNames, collegeNames, assetTypeNames, customFieldLabels);
    };
    const history: HistoryItem[] = [];
    const recordedFields = ['name', 'category', 'manufacturer', 'model', 'serialNumber', 'assetTypeId', 'location', 'status', 'purchaseDate', 'warrantyExpiry', 'notes', 'customFields', 'labId', 'collegeId'];
    const currentDetails = recordedFields
      .filter((key) => (asset as any)[key] !== null && (asset as any)[key] !== undefined && (asset as any)[key] !== '')
      .map((key) => `${FIELD_LABELS[key] || key}: ${formatValue(key, (asset as any)[key])}`)
      .join('; ');

    // Older assets may not have a CREATE audit entry, so use the asset's
    // original database metadata as a fallback for the registration event.
    const createAudit = auditRows.find(({ audit }) => audit.action === 'CREATE');
    if (!createAudit) history.push({
      id: `registered-${asset.id}`, date: asset.createdAt, kind: 'created', title: 'Asset added to inventory',
      actor: asset.createdById ? actorNames.get(asset.createdById) || 'Unknown' : 'Unknown',
      details: `Original field-by-field audit details are not available. Current recorded details: ${currentDetails || 'No asset details available.'}`,
    });
    if (!createAudit && asset.purchaseDate) history.push({ id: `purchase-${asset.id}`, date: asset.purchaseDate, kind: 'created', title: 'Purchase date recorded', actor: asset.createdById ? actorNames.get(asset.createdById) || 'Recorded in asset details' : 'Recorded in asset details', details: `Recorded purchase date: ${asset.purchaseDate.toLocaleDateString()}.` });

    for (const { audit, actorName } of auditRows) {
      let changes: Record<string, any> = {};
      try { changes = audit.changes ? JSON.parse(audit.changes) : {}; } catch { changes = {}; }
      if (audit.action === 'CREATE') {
        const details = Object.entries(changes)
          .filter(([key, value]) => !['unchanged', 'createdById', 'updatedById'].includes(key) && value !== null && value !== undefined && value !== '')
          .map(([key, value]) => `${FIELD_LABELS[key] || key}: ${formatValue(key, value)}`)
          .join('; ');
        const purchaseValue = Object.hasOwn(changes, 'purchaseDate') ? changes.purchaseDate : asset.purchaseDate;
        const purchaseDate = purchaseValue ? new Date(purchaseValue).toLocaleDateString() : null;
        if (purchaseDate) history.push({ id: `purchase-${asset.id}`, date: new Date(purchaseValue), kind: 'created', title: 'Purchase date recorded', actor: actorName || 'Recorded in asset details', details: `Recorded purchase date: ${purchaseDate}.` });
        history.push({ id: `audit-${audit.id}`, date: audit.createdAt, kind: 'created', title: 'Asset added to inventory', actor: actorName || 'Unknown', details: details || 'Initial asset details recorded.' });
      } else if (audit.action === 'DELETE') {
        history.push({ id: `audit-${audit.id}`, date: audit.createdAt, kind: 'removed', title: 'Asset removed', actor: actorName || 'Unknown', details: changes.removalReason ? `Reason: ${changes.removalReason}` : 'Asset was removed from active inventory.' });
      } else {
        const entries = Object.entries(changes).filter(([key]) => !['unchanged', 'collegeId'].includes(key));
        const details = entries.map(([key, value]) => {
          if (key === 'labId' && value && typeof value === 'object') return `Laboratory: ${labNames.get(Number((value as any).from)) || 'Previous lab'} → ${labNames.get(Number((value as any).to)) || 'New lab'}`;
          const diff = value && typeof value === 'object' && 'from' in value && 'to' in value ? value as { from: unknown; to: unknown } : null;
          return `${FIELD_LABELS[key] || key}: ${diff ? `${formatValue(key, diff.from)} → ${formatValue(key, diff.to)}` : formatValue(key, value)}`;
        }).join('; ');
        if (details || audit.action !== 'UPDATE') history.push({ id: `audit-${audit.id}`, date: audit.createdAt, kind: 'updated', title: audit.action === 'IMPORT' ? 'Asset imported' : 'Asset details updated', actor: actorName || 'Unknown', details: details || audit.action });
      }
    }

    for (const { request: row } of requestRows) {
      const requester = actorNames.get(row.requesterId) || 'Unknown';
      history.push({ id: `request-${row.id}`, date: row.createdAt, kind: 'request', title: `${row.loanType === 'permanent' ? 'Transfer' : 'Borrow'} requested`, actor: requester, details: `Requested for ${labNames.get(row.requesterLabId) || 'another lab'}${row.notes ? `. Note: ${row.notes}` : ''}. Status: ${row.status}.` });
      if (row.reviewedAt && row.status === 'rejected') history.push({ id: `request-review-${row.id}`, date: row.reviewedAt, kind: 'request', title: `${row.loanType === 'permanent' ? 'Transfer' : 'Borrow'} request rejected`, actor: row.reviewedById ? actorNames.get(row.reviewedById) || 'Unknown' : 'Unknown', details: 'The request was reviewed and rejected.' });
    }

    for (const { loan } of loanRows) {
      const borrower = actorNames.get(loan.borrowerId) || 'Unknown';
      if (loan.loanType === 'permanent') {
        const priorMoves = loanRows.map(({ loan: other }) => other).filter((other) => other.loanType === 'permanent' && other.loanDate < loan.loanDate).sort((a, b) => a.loanDate.getTime() - b.loanDate.getTime());
        const priorDestination = priorMoves.at(-1)?.borrowerLabId;
        const originalLab = auditRows.find(({ audit }) => audit.action === 'CREATE');
        let fromName = priorDestination ? labNames.get(priorDestination) : undefined;
        if (!fromName && originalLab) { try { const details = JSON.parse(originalLab.audit.changes || '{}'); fromName = labNames.get(Number(details.labId)); } catch { /* Use generic source below. */ } }
        history.push({ id: `loan-${loan.id}`, date: loan.loanDate, kind: 'transfer', title: 'Asset permanently transferred', actor: actorNames.get(loan.approverId) || 'Unknown', details: `${fromName || 'Previous lab'} → ${labNames.get(loan.borrowerLabId) || 'Destination lab'}; requested by ${borrower}.` });
      } else {
        history.push({ id: `loan-${loan.id}`, date: loan.loanDate, kind: 'loan', title: 'Asset borrowed', actor: borrower, details: `Approved by ${actorNames.get(loan.approverId) || 'Unknown'} for ${labNames.get(loan.borrowerLabId) || 'the requesting lab'}${loan.expectedReturnDate ? `; expected return ${loan.expectedReturnDate.toLocaleDateString()}` : ''}.` });
        if (loan.actualReturnDate || loan.status === 'returned') history.push({ id: `return-${loan.id}`, date: loan.actualReturnDate || loan.createdAt, kind: 'return', title: 'Asset returned', actor: 'Recorded in loan history', details: 'The loan was marked as returned.' });
      }
    }

    for (const { request: row } of modificationRows) {
      const proposed = Object.entries(row.proposedChanges || {}).map(([key, value]) => {
        const previousValue = row.originalValues?.[key as keyof typeof row.originalValues];
        const label = FIELD_LABELS[key] || key;
        return `${label}: ${formatValue(key, previousValue)} → ${formatValue(key, value)}`;
      }).join('; ');
      history.push({ id: `modification-${row.id}`, date: row.createdAt, kind: 'request', title: 'Change suggested', actor: actorNames.get(row.requestedById) || 'Unknown', details: `${proposed || 'Asset details proposed'}. Reason: ${row.reason}. Status: ${row.status}.` });
      if (row.reviewedAt) history.push({ id: `modification-review-${row.id}`, date: row.reviewedAt, kind: 'request', title: `Suggested change ${row.status}`, actor: row.reviewedById ? actorNames.get(row.reviewedById) || 'Unknown' : 'Unknown', details: row.reviewNote || `The suggested change was ${row.status}.` });
    }

    history.sort((a, b) => b.date.getTime() - a.date.getTime());
    return NextResponse.json({ asset: { id: asset.id, name: asset.name }, history });
  } catch (error) {
    if (error instanceof RateLimitError) return NextResponse.json({ error: 'Rate limit exceeded', retryAfter: error.retryAfter }, { status: 429, headers: { 'Retry-After': error.retryAfter.toString() } });
    logger.error('Error fetching asset history', { error });
    return NextResponse.json({ error: sanitizeError(error) }, { status: 500 });
  }
}
