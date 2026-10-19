import type { Asset } from '@/db/schema';
import { validateAssetInput, ValidationError } from '@/lib/validation';

export const EDITABLE_ASSET_FIELDS = [
  'name',
  'category',
  'manufacturer',
  'model',
  'serialNumber',
  'location',
  'status',
  'purchaseDate',
  'warrantyExpiry',
  'notes',
  'customFields',
] as const;

export type EditableAssetField = typeof EDITABLE_ASSET_FIELDS[number];
export type AssetFieldValues = Partial<Record<EditableAssetField, unknown>>;

const editableFields = new Set<string>(EDITABLE_ASSET_FIELDS);
const nullableFields = new Set<EditableAssetField>([
  'manufacturer', 'model', 'serialNumber', 'purchaseDate', 'warrantyExpiry', 'notes',
]);
const dateFields = new Set<EditableAssetField>(['purchaseDate', 'warrantyExpiry']);

export function normalizeAssetField(field: EditableAssetField, value: unknown): unknown {
  if (value === null || value === undefined || value === '') return null;
  if (dateFields.has(field)) {
    const date = value instanceof Date ? value : new Date(String(value));
    return Number.isNaN(date.getTime()) ? value : date.toISOString();
  }
  return value;
}

/** Validate an explicit partial edit using the same rules as direct asset edits. */
export function validateProposedChanges(asset: Asset, input: unknown): {
  proposedChanges: Record<string, unknown>;
  originalValues: Record<string, unknown>;
} {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new ValidationError('proposedChanges must be an object');
  }
  const proposed = input as Record<string, unknown>;
  const keys = Object.keys(proposed);
  if (keys.length === 0) throw new ValidationError('At least one proposed field is required');
  const unknown = keys.filter((key) => !editableFields.has(key));
  if (unknown.length) {
    throw new ValidationError(`Unknown or non-editable field: ${unknown[0]}`);
  }
  for (const key of keys as EditableAssetField[]) {
    if (nullableFields.has(key) && !dateFields.has(key) && proposed[key] !== null && proposed[key] !== undefined && typeof proposed[key] !== 'string') {
      throw new ValidationError(`${key} must be a string or null`);
    }
  }

  const candidate: Record<string, unknown> = {
    name: asset.name,
    category: asset.category,
    manufacturer: asset.manufacturer ?? '',
    model: asset.model ?? '',
    serialNumber: asset.serialNumber ?? '',
    location: asset.location,
    status: asset.status,
    purchaseDate: asset.purchaseDate?.toISOString() ?? '',
    warrantyExpiry: asset.warrantyExpiry?.toISOString() ?? '',
    notes: asset.notes ?? '',
    customFields: asset.customFields ?? {},
    ...proposed,
  };
  const validated = validateAssetInput(candidate);
  const proposedChanges: Record<string, unknown> = {};
  const originalValues: Record<string, unknown> = {};

  for (const key of keys as EditableAssetField[]) {
    let value: unknown;
    if (key === 'customFields') {
      value = proposed.customFields;
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ValidationError('customFields must be an object');
    } else if (dateFields.has(key)) {
      value = (validated[key] as Date | undefined)?.toISOString() ?? null;
    } else if (nullableFields.has(key)) {
      const validatedValue = validated[key];
      value = validatedValue === undefined || validatedValue === '' ? null : validatedValue;
    } else {
      value = validated[key];
    }
    const original = normalizeAssetField(key, asset[key]);
    if (JSON.stringify(value) === JSON.stringify(original)) continue;
    proposedChanges[key] = value;
    originalValues[key] = original;
  }

  if (Object.keys(proposedChanges).length === 0) {
    throw new ValidationError('The proposed changes do not change any asset fields');
  }
  return { proposedChanges, originalValues };
}

export function validateReason(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError('A reason is required');
  }
  const reason = value.trim();
  if (reason.length > 2000) throw new ValidationError('Reason must be 2000 characters or fewer');
  return reason;
}

export function validateReviewNote(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new ValidationError('reviewNote must be a string');
  const note = value.trim();
  if (note.length > 2000) throw new ValidationError('Review note must be 2000 characters or fewer');
  return note || null;
}

export function pickEditableAssetChanges(changes: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const field of EDITABLE_ASSET_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(changes, field)) result[field] = changes[field];
  }
  return result;
}
