import { describe, it, expect, afterAll } from 'vitest';
import { SignJWT } from 'jose';
import { createSessionToken, verifySessionToken } from '@/lib/auth-jwt';
import { pool } from '@/db';

const USER = {
  id: 42,
  email: 'user@manipal.edu',
  name: 'Unit Tester',
  role: 'technician',
  collegeId: 4,
  labId: 6,
  sessionVersion: 0,
} as const;

const SECRET = process.env.JWT_SECRET || 'dev-only-insecure-secret';

// @/db opens a Pool on import; close it so the worker's event loop drains.
afterAll(async () => {
  await pool.end();
});

function b64url(input: string): string {
  return Buffer.from(input, 'utf-8').toString('base64url');
}

describe('session tokens', () => {
  it('round-trips a token created by createSessionToken', async () => {
    const token = await createSessionToken(USER);
    const session = await verifySessionToken(token);
    expect(session).not.toBeNull();
    expect(session!.user).toEqual(USER);
  });

  it('returns null for a tampered payload', async () => {
    const token = await createSessionToken(USER);
    const [header, payload, signature] = token.split('.');
    const forged = b64url(JSON.stringify({ ...USER, role: 'admin' }));
    const tampered = `${header}.${forged}.${signature}`;
    expect(await verifySessionToken(tampered)).toBeNull();
  });

  it('returns null for a token signed with a different secret', async () => {
    const other = await new SignJWT({ user: USER })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(new TextEncoder().encode('a-completely-different-secret-0123456789'));
    expect(await verifySessionToken(other)).toBeNull();
  });

  it('returns null for an expired token', async () => {
    const expired = await new SignJWT({ user: USER })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(-3600) // 1 hour ago
      .sign(new TextEncoder().encode(SECRET));
    expect(await verifySessionToken(expired)).toBeNull();
  });

  it('returns null for garbage input', async () => {
    expect(await verifySessionToken('not-a-jwt')).toBeNull();
    expect(await verifySessionToken('')).toBeNull();
  });
});