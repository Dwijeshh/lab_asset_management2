import { describe, expect, it } from 'vitest';
import type { AssetTypeField } from '@/db/schema';
import { validateCustomFieldValues } from '@/lib/customFields';
import { monthBoundsUtc } from '@/lib/monthlyReport';
import { safeCellString } from '@/lib/importAssets';

const definitions = [
  { fieldKey: 'serial', label: 'Serial', type: 'text', required: true, options: [] },
  { fieldKey: 'count', label: 'Count', type: 'number', required: true, options: [] },
  { fieldKey: 'checked_on', label: 'Checked on', type: 'date', required: false, options: [] },
  { fieldKey: 'calibrated', label: 'Calibrated', type: 'boolean', required: true, options: [] },
  { fieldKey: 'condition', label: 'Condition', type: 'select', required: true, options: ['good', 'repair'] },
] as unknown as AssetTypeField[];

describe('configurable asset fields', () => {
  it('validates and normalizes all supported custom field types', () => {
    expect(validateCustomFieldValues(definitions, { serial: '  SN-1 ', count: 2, checked_on: '2025-04-05', calibrated: false, condition: 'good' })).toEqual({
      serial: 'SN-1', count: 2, checked_on: '2025-04-05', calibrated: false, condition: 'good',
    });
  });
  it('rejects unknown keys, missing required values, bad types and unsupported options', () => {
    expect(() => validateCustomFieldValues(definitions, { serial: 'A', count: 1, calibrated: true, condition: 'bad', extra: 2 })).toThrow(/unknown custom field/i);
    expect(() => validateCustomFieldValues(definitions, { serial: 'A', count: 1, calibrated: true, condition: 'bad' })).toThrow(/select a valid/i);
    expect(() => validateCustomFieldValues(definitions, { serial: 'A', count: 'one', calibrated: true, condition: 'good' })).toThrow(/must be a number/i);
    expect(() => validateCustomFieldValues(definitions, { serial: 'A', count: 1, calibrated: true })).toThrow(/condition is required/i);
  });
});

describe('institution-local reporting boundaries', () => {
  it('calculates month boundaries in the institution timezone, then returns UTC', () => {
    expect(monthBoundsUtc('2026-01', 'Asia/Kolkata')).toEqual({ start: new Date('2025-12-31T18:30:00.000Z'), end: new Date('2026-01-31T18:30:00.000Z') });
    expect(monthBoundsUtc('2026-04', 'America/Los_Angeles').start).toEqual(new Date('2026-04-01T07:00:00.000Z'));
  });
  it('writes spreadsheet formula-like content as literal text', () => {
    expect(safeCellString('=HYPERLINK("https://example.invalid")')).toBe('\'=HYPERLINK("https://example.invalid")');
    expect(safeCellString('Laptop')).toBe('Laptop');
  });
});
