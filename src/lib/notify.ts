import { db } from '@/db';
import { notifications, users, labs, labAssignments, assetTypeFields } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { logger } from '@/lib/logger';

export interface NotifyAssetChangeParams {
  action: 'created' | 'updated' | 'deleted';
  assetName: string;
  labId: number;
  oldLabId?: number;
  actor: { id: number; name: string };
  changes?: Record<string, unknown>;
  assetTypeId?: number | null;
}

/**
 * Sends in-app notifications on asset creation, update, or deletion.
 *
 * Recipients:
 *  a) all active admins
 *  b) all active technicians whose labId is the asset's lab (old and new on a move)
 *  c) other head technicians assigned to that lab
 *
 * Never notifies the actor who performed the change.
 * Wrapped in try/catch so notification failures never disrupt the main operation.
 */
export async function notifyAssetChange(params: NotifyAssetChangeParams): Promise<void> {
  try {
    const { action, assetName, labId, oldLabId, actor, changes } = params;

    const labIds = [labId];
    if (oldLabId !== undefined && oldLabId !== labId) {
      labIds.push(oldLabId);
    }

    // Fetch lab name(s)
    const labRows = await db
      .select({ id: labs.id, name: labs.name })
      .from(labs)
      .where(inArray(labs.id, labIds));

    const labMap = new Map<number, string>(labRows.map((l) => [l.id, l.name]));
    const currentLabName = labMap.get(labId) || `Lab #${labId}`;

    const recipientUserIds = new Set<number>();

    // a) all active admins
    const admins = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.role, 'admin'), eq(users.isActive, true)));
    for (const a of admins) {
      recipientUserIds.add(a.id);
    }

    // b) all active technicians whose labId is the asset's lab (old and new lab on a move)
    const technicians = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.role, 'technician'),
          eq(users.isActive, true),
          inArray(users.labId, labIds)
        )
      );
    for (const t of technicians) {
      recipientUserIds.add(t.id);
    }

    // c) other head technicians assigned to that lab
    const headTechnicians = await db
      .select({ userId: labAssignments.userId })
      .from(labAssignments)
      .innerJoin(users, eq(labAssignments.userId, users.id))
      .where(
        and(
          eq(users.role, 'main_technician'),
          eq(users.isActive, true),
          inArray(labAssignments.labId, labIds)
        )
      );
    for (const ht of headTechnicians) {
      recipientUserIds.add(ht.userId);
    }

    // Never notify the person who made the change
    recipientUserIds.delete(actor.id);

    if (recipientUserIds.size === 0) {
      return;
    }

    let notificationType: 'asset_created' | 'asset_updated' | 'asset_deleted';
    let title: string;
    let message: string;

    if (action === 'created') {
      notificationType = 'asset_created';
      title = 'Asset Added';
      message = `${assetName} in ${currentLabName} was added by ${actor.name}`;
    } else if (action === 'deleted') {
      notificationType = 'asset_deleted';
      title = 'Asset Removed';
      message = `${assetName} in ${currentLabName} was removed by ${actor.name}`;
    } else {
      notificationType = 'asset_updated';
      title = 'Asset Updated';
      const changedKeys = changes
        ? Object.keys(changes).filter((k) => k !== 'unchanged')
        : [];
      const labels: Record<string, string> = {
        name: 'Name', category: 'Category', manufacturer: 'Manufacturer', model: 'Model', serialNumber: 'Serial number',
        location: 'Location', status: 'Status', purchaseDate: 'Purchase date', warrantyExpiry: 'Warranty expiry', notes: 'Notes', labId: 'Lab',
      };
      if (params.assetTypeId) {
        const definitions = await db.select({ fieldKey: assetTypeFields.fieldKey, label: assetTypeFields.label }).from(assetTypeFields).where(eq(assetTypeFields.assetTypeId, params.assetTypeId));
        for (const field of definitions) labels[field.fieldKey] = field.label;
      }
      const readableKeys = changedKeys.flatMap((key) => {
        if (key === 'customFields' && changes?.customFields && typeof changes.customFields === 'object') {
          const diff = changes.customFields as { from?: Record<string, unknown>; to?: Record<string, unknown> };
          const customKeys = new Set([...Object.keys(diff.from || {}), ...Object.keys(diff.to || {})]);
          const actual = [...customKeys].filter((fieldKey) => JSON.stringify(diff.from?.[fieldKey]) !== JSON.stringify(diff.to?.[fieldKey]));
          return actual.map((fieldKey) => labels[fieldKey] || fieldKey);
        }
        return [labels[key] || key.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`)];
      });
      if (changedKeys.length > 0) {
        message = `${assetName} in ${currentLabName} was updated by ${actor.name} (${readableKeys.join(', ')})`;
      } else {
        message = `${assetName} in ${currentLabName} was updated by ${actor.name}`;
      }
    }

    await db.insert(notifications).values(
      Array.from(recipientUserIds).map((userId) => ({
        userId,
        type: notificationType,
        title,
        message,
      }))
    );
  } catch (error) {
    logger.error('Failed to send asset notification', { error });
  }
}

export async function notifyAssetImport(params: { assetCount: number; labId: number; actor: { id: number; name: string } }): Promise<void> {
  try {
    const [lab] = await db.select({ name: labs.name }).from(labs).where(eq(labs.id, params.labId)).limit(1);
    const recipientIds = new Set<number>();
    const admins = await db.select({ id: users.id }).from(users).where(and(eq(users.role, 'admin'), eq(users.isActive, true)));
    admins.forEach((user) => recipientIds.add(user.id));
    const technicians = await db.select({ id: users.id }).from(users).where(and(eq(users.role, 'technician'), eq(users.isActive, true), eq(users.labId, params.labId)));
    technicians.forEach((user) => recipientIds.add(user.id));
    const heads = await db.select({ userId: labAssignments.userId }).from(labAssignments).innerJoin(users, eq(labAssignments.userId, users.id))
      .where(and(eq(labAssignments.labId, params.labId), eq(users.role, 'main_technician'), eq(users.isActive, true)));
    heads.forEach((user) => recipientIds.add(user.userId));
    recipientIds.delete(params.actor.id);
    if (!recipientIds.size) return;
    await db.insert(notifications).values([...recipientIds].map((userId) => ({ userId, type: 'asset_imported' as const, title: 'Assets imported', message: `${params.assetCount} assets in ${lab?.name || `Lab #${params.labId}`} were imported by ${params.actor.name}` })));
  } catch (error) {
    logger.error('Failed to send asset import notification', { error });
  }
}
