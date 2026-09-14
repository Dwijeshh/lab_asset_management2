// Audit trail helper — the single place that writes to `audit_logs`.
//
// Conventions shared with the existing call sites (borrowing, user admin):
//   • action      — CREATE | UPDATE | DELETE | APPROVE | REJECT ...
//   • entityType  — 'asset' | 'asset_request' | 'asset_loan' | 'user' | 'lab'
//   • entityId    — primary key of the entity
//   • changes     — JSON string of the changed/created/deleted fields
//
// Audit writes must never break the operation that triggered them: a failed
// insert is logged and swallowed, not thrown into the route's error path.
import { db } from '@/db';
import { auditLogs } from '@/db/schema';
import { logger } from '@/lib/logger';

export interface AuditEntry {
  userId: number | null;
  action: string;
  entityType: string;
  entityId: number;
  changes?: unknown;
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      userId: entry.userId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      changes: entry.changes === undefined ? null : JSON.stringify(entry.changes),
    });
  } catch (error) {
    // The triggering operation has already succeeded; losing the trail entry
    // is logged but never propagates.
    logger.error('Failed to write audit log', {
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      error,
    });
  }
}
