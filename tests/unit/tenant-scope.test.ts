import { describe, it, expect, afterAll } from 'vitest';
import {
  parseCollegeIdParam,
  resolveCollegeFilter,
  canAccessCollege,
} from '@/lib/auth-jwt';
import { pool } from '@/db';

// @/db opens a Pool on import; close it so the worker's event loop drains.
afterAll(async () => {
  await pool.end();
});

const ADMIN = { role: 'admin', collegeId: 4 } as const;
const TECH = { role: 'technician', collegeId: 4 } as const;
const MAIN_TECH = { role: 'main_technician', collegeId: 5 } as const;

describe('parseCollegeIdParam', () => {
  it('maps empty values to "all colleges" (null)', () => {
    for (const value of [null, undefined, '', 'all']) {
      expect(parseCollegeIdParam(value)).toBeNull();
    }
  });

  it('parses a positive integer', () => {
    expect(parseCollegeIdParam('4')).toBe(4);
  });

  it('rejects malformed values instead of producing NaN', () => {
    for (const value of ['abc', '0', '-3', '4.5']) {
      expect(() => parseCollegeIdParam(value)).toThrow();
    }
  });
});

describe('resolveCollegeFilter', () => {
  it('locks non-admins to their own college regardless of what they request', () => {
    expect(resolveCollegeFilter(TECH, '5')).toBe(4);
    expect(resolveCollegeFilter(TECH, null)).toBe(4);
    expect(resolveCollegeFilter(MAIN_TECH, 'all')).toBe(5);
  });

  it('lets admins request a specific college or all colleges', () => {
    expect(resolveCollegeFilter(ADMIN, '5')).toBe(5);
    expect(resolveCollegeFilter(ADMIN, 'all')).toBeNull();
    expect(resolveCollegeFilter(ADMIN, null)).toBeNull();
  });

  it('propagates malformed admin requests so callers can reject them', () => {
    expect(() => resolveCollegeFilter(ADMIN, 'abc')).toThrow();
  });
});

describe('canAccessCollege', () => {
  it('is the only admin bypass', () => {
    expect(canAccessCollege(ADMIN, 5)).toBe(true);
    expect(canAccessCollege(ADMIN, null)).toBe(true);
  });

  it('requires an exact match for non-admins', () => {
    expect(canAccessCollege(TECH, 4)).toBe(true);
    expect(canAccessCollege(TECH, 5)).toBe(false);
    expect(canAccessCollege(TECH, null)).toBe(false);
    expect(canAccessCollege(MAIN_TECH, 5)).toBe(true);
  });
});