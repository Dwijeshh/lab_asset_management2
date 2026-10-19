import * as XLSX from 'xlsx';
import { assets, assetTypeFields } from '@/db/schema';
import { isValidCategory, validateAssetInput, ValidationError } from '@/lib/validation';
import { validateCustomFieldValues } from '@/lib/customFields';
import type { AssetType } from '@/db/schema';

export const MAX_IMPORT_BYTES = 8 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 1000;
export const IMPORT_TARGETS = ['name', 'category', 'manufacturer', 'model', 'serialNumber', 'location', 'status', 'purchaseDate', 'warrantyExpiry', 'notes'] as const;

export function parseImportWorkbook(buffer: Buffer, extension: string) {
  if (!['.xlsx', '.csv'].includes(extension.toLowerCase())) throw new ValidationError('Upload an .xlsx or .csv file');
  const workbook = XLSX.read(buffer, {
    type: 'buffer',
    cellDates: true,
    raw: false,
    // Uploaded workbooks are untrusted: do not retain formula or HTML payloads.
    cellFormula: false,
    cellHTML: false,
  });
  return workbook;
}

export function normalizeImportRows(
  rows: Record<string, unknown>[],
  mapping: Record<string, string>,
  type: AssetType,
  fields: typeof assetTypeFields.$inferSelect[],
) {
  if (rows.length > MAX_IMPORT_ROWS) throw new ValidationError(`The selected sheet exceeds the ${MAX_IMPORT_ROWS} row limit`);
  const serials = new Set<string>();
  return rows.map((row, index) => {
    try {
      const source: Record<string, unknown> = {};
      const custom: Record<string, unknown> = {};
      for (const target of IMPORT_TARGETS) {
        const column = mapping[target];
        if (column) source[target] = row[column] ?? '';
      }
      for (const field of fields) {
        const column = mapping[`custom:${field.fieldKey}`];
        if (column) custom[field.fieldKey] = row[column] ?? '';
      }
      source.category = typeof source.category === 'string' && isValidCategory(source.category)
        ? source.category : (type.legacyCategory || 'other');
      const validated = validateAssetInput(source);
      const customFields = validateCustomFieldValues(fields, custom);
      const serial = validated.serialNumber?.trim().toLocaleLowerCase();
      const duplicate = serial ? serials.has(serial) : false;
      if (serial) serials.add(serial);
      return { rowNumber: index + 2, valid: !duplicate, duplicate, error: duplicate ? 'Duplicate serial number within this file' : null, asset: {
        name: validated.name, category: validated.category, manufacturer: validated.manufacturer ?? null,
        model: validated.model ?? null, serialNumber: validated.serialNumber ?? null,
        location: validated.location, status: validated.status, purchaseDate: validated.purchaseDate ?? null,
        warrantyExpiry: validated.warrantyExpiry ?? null, notes: validated.notes ?? null,
        customFields,
      } };
    } catch (error) {
      return { rowNumber: index + 2, valid: false, duplicate: false, error: error instanceof Error ? error.message : 'Invalid row', asset: null };
    }
  });
}

export function workbookRows(sheet: XLSX.WorkSheet) {
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: false });
  return rows.filter((row) => Object.values(row).some((value) => String(value).trim() !== ''));
}

export function safeCellString(value: unknown): string {
  const text = String(value ?? '');
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}
