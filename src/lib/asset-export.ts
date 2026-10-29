import type { Asset } from '@/db/schema';
import { CATEGORY_LABELS, STATUS_LABELS } from '@/lib/assets';

export const EXPORT_COLUMNS = [
  { key: 'name', label: 'Asset name' },
  { key: 'category', label: 'Category' },
  { key: 'status', label: 'Status' },
  { key: 'college', label: 'Institution' },
  { key: 'lab', label: 'Laboratory' },
  { key: 'location', label: 'Location' },
  { key: 'serialNumber', label: 'Serial number' },
  { key: 'manufacturer', label: 'Manufacturer' },
  { key: 'model', label: 'Model' },
  { key: 'purchaseDate', label: 'Purchase date' },
  { key: 'warrantyExpiry', label: 'Warranty expiry' },
  { key: 'notes', label: 'Notes' },
] as const;

export type ExportColumn = (typeof EXPORT_COLUMNS)[number]['key'];
export type ExportAsset = { asset: Asset; collegeName: string | null; labName: string };

export const DEFAULT_EXPORT_COLUMNS: ExportColumn[] = [
  'name', 'category', 'status', 'college', 'lab', 'location', 'serialNumber',
];

export function parseExportColumns(value: string | null): ExportColumn[] | null {
  if (value === null) return DEFAULT_EXPORT_COLUMNS;
  const requested = value.split(',');
  const valid = new Set<string>(EXPORT_COLUMNS.map(column => column.key));
  if (!requested.length || requested.length > EXPORT_COLUMNS.length ||
      requested.some(key => !valid.has(key)) || new Set(requested).size !== requested.length) return null;
  return EXPORT_COLUMNS.map(column => column.key).filter(key => key === 'name' || requested.includes(key));
}

function dateValue(value: Date | null): string {
  return value ? new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(value) : '—';
}

export function exportValue(row: ExportAsset, column: ExportColumn): string {
  const asset = row.asset;
  switch (column) {
    case 'name': return asset.name;
    case 'category': return CATEGORY_LABELS[asset.category] ?? asset.category;
    case 'status': return STATUS_LABELS[asset.status] ?? asset.status;
    case 'college': return row.collegeName ?? '—';
    case 'lab': return row.labName;
    case 'location': return asset.location;
    case 'serialNumber': return asset.serialNumber || '—';
    case 'manufacturer': return asset.manufacturer || '—';
    case 'model': return asset.model || '—';
    case 'purchaseDate': return dateValue(asset.purchaseDate);
    case 'warrantyExpiry': return dateValue(asset.warrantyExpiry);
    case 'notes': return asset.notes || '—';
  }
}

export function exportLabel(column: ExportColumn): string {
  return EXPORT_COLUMNS.find(item => item.key === column)!.label;
}
