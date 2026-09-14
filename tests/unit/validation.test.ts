import { describe, it, expect } from 'vitest';
import {
  validateEmail,
  validatePassword,
  validateAssetInput,
  validateSearchParams,
  ValidationError,
} from '@/lib/validation';

describe('validateEmail', () => {
  it('accepts a valid email and normalizes it', () => {
    expect(validateEmail('  User@Example.COM ')).toBe('user@example.com');
  });

  it('rejects malformed emails', () => {
    for (const bad of ['', 'not-an-email', 'a@b', 'a@.com', 'a b@c.com', '@x.com', 'a@b c.com']) {
      expect(() => validateEmail(bad), `expected ${bad!} to be rejected`).toThrow(ValidationError);
    }
  });
});

describe('validatePassword', () => {
  it('accepts a password with 8+ chars, a letter and a digit', () => {
    expect(validatePassword('CorrectHorse42')).toBe('CorrectHorse42');
  });

  it('rejects short, letter-only and digit-only passwords', () => {
    expect(() => validatePassword('Short1')).toThrow(ValidationError);
    expect(() => validatePassword('onlyletters')).toThrow(ValidationError);
    expect(() => validatePassword('12345678')).toThrow(ValidationError);
  });
});

describe('validateAssetInput', () => {
  it('rejects missing required fields', () => {
    expect(() => validateAssetInput({})).toThrow(ValidationError);
    expect(() => validateAssetInput({ name: 'X', location: 'Y' })).toThrow(ValidationError);
  });

  it('rejects an invalid category and status', () => {
    const base = { name: 'X', location: 'Y', category: 'toaster' };
    expect(() => validateAssetInput(base)).toThrow(ValidationError);
    expect(() => validateAssetInput({ ...base, category: 'laptop', status: 'broken' })).toThrow(ValidationError);
  });

  it('rejects a purchase date in the future', () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    expect(() =>
      validateAssetInput({ name: 'X', location: 'Y', category: 'laptop', purchaseDate: future })
    ).toThrow(ValidationError);
  });

  it('rejects warranty expiry before purchase date', () => {
    expect(() =>
      validateAssetInput({
        name: 'X',
        location: 'Y',
        category: 'laptop',
        purchaseDate: '2024-06-01',
        warrantyExpiry: '2023-01-01',
      })
    ).toThrow(ValidationError);
  });

  it('accepts a valid asset and trims/sanitizes strings', () => {
    const result = validateAssetInput({
      name: '  Dell Monitor  ',
      location: ' Bench 1 ',
      category: 'monitor',
      manufacturer: 'Dell',
    });
    expect(result.name).toBe('Dell Monitor');
    expect(result.location).toBe('Bench 1');
    expect(result.status).toBe('available');
  });
});

describe('validateSearchParams', () => {
  it('applies pagination defaults', () => {
    const params = validateSearchParams(new URLSearchParams());
    expect(params.page).toBe(1);
    expect(params.limit).toBe(50);
  });

  it('ignores out-of-range limits and invalid filters (falls back to defaults)', () => {
    const params = validateSearchParams(new URLSearchParams({ limit: '500', status: 'bogus' }));
    expect(params.limit).toBe(50);
    expect(params.status).toBeUndefined();
  });

  it('keeps valid filters and trims the search term', () => {
    const params = validateSearchParams(
      new URLSearchParams({ search: '  pro  ', status: 'in_use', category: 'laptop' })
    );
    expect(params.search).toBe('pro');
    expect(params.status).toBe('in_use');
    expect(params.category).toBe('laptop');
  });
});