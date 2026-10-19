import { describe, expect, it } from 'vitest';
import type { Asset } from '@/db/schema';
import { validateProposedChanges, validateReason } from '@/lib/assetModification';

const asset = {
  id: 9,
  name: 'Scope',
  category: 'oscilloscope',
  manufacturer: 'Acme',
  model: null,
  serialNumber: null,
  collegeId: 1,
  labId: 2,
  location: 'Bench 1',
  status: 'available',
  purchaseDate: new Date('2020-01-01T00:00:00.000Z'),
  warrantyExpiry: null,
  notes: null,
  createdById: 3,
  updatedById: 3,
  createdAt: new Date(),
  updatedAt: new Date(),
} as Asset;

describe('asset modification proposal validation', () => {
  it('normalizes and snapshots only actual editable field changes', () => {
    expect(validateProposedChanges(asset, { name: ' New scope ', notes: 'Verified' })).toEqual({
      proposedChanges: { name: 'New scope', notes: 'Verified' },
      originalValues: { name: 'Scope', notes: null },
    });
  });

  it('allows clearing nullable fields and stores null explicitly', () => {
    expect(validateProposedChanges(asset, { manufacturer: null })).toEqual({
      proposedChanges: { manufacturer: null },
      originalValues: { manufacturer: 'Acme' },
    });
  });

  it('rejects system fields and unknown proposed fields', () => {
    expect(() => validateProposedChanges(asset, { labId: 4 })).toThrow(/non-editable/);
    expect(() => validateProposedChanges(asset, { mystery: true })).toThrow(/non-editable/);
  });

  it('rejects empty, no-op, and invalid values', () => {
    expect(() => validateProposedChanges(asset, {})).toThrow(/at least one/i);
    expect(() => validateProposedChanges(asset, { name: 'Scope' })).toThrow(/do not change/i);
    expect(() => validateProposedChanges(asset, { name: '' })).toThrow(/name is required/i);
    expect(() => validateProposedChanges(asset, { manufacturer: 42 })).toThrow(/string or null/i);
    expect(() => validateProposedChanges(asset, { category: 'not-a-category' })).toThrow(/invalid category/i);
  });

  it('requires a nonempty, bounded reason', () => {
    expect(() => validateReason('   ')).toThrow(/reason is required/i);
    expect(() => validateReason('x'.repeat(2001))).toThrow(/2000 characters/i);
    expect(validateReason('  Replace worn cable  ')).toBe('Replace worn cable');
  });
});
