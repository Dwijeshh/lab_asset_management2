import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';

const SECRET_KEY = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_SECRET = new TextEncoder().encode(SECRET_KEY);

export interface SessionUser {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'main_technician' | 'technician';
  collegeId: number;
  labId: number | null;
}

export interface SessionData {
  user: SessionUser;
  expires: string;
}

// Create a new session token
export async function createSessionToken(user: SessionUser): Promise<string> {
  const token = await new SignJWT({ user })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET);

  return token;
}

// Verify and decode session token
export async function verifySessionToken(token: string): Promise<SessionData | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.user && typeof payload.user === 'object') {
      return payload as unknown as SessionData;
    }
    return null;
  } catch (error) {
    return null;
  }
}

// Get current session from cookies
export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('session')?.value;

  if (!token) {
    return null;
  }

  return verifySessionToken(token);
}

// Set session cookie
export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });
}

// Clear session cookie
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete('session');
}

// Hash password
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

// Verify password
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Role-based permission checks
export function canCreateLabs(role: string): boolean {
  return role === 'admin' || role === 'main_technician';
}

export function canManageUsers(role: string): boolean {
  return role === 'admin';
}

export function canDeleteAssets(role: string): boolean {
  return role === 'admin' || role === 'main_technician';
}

export function canCreateAssets(role: string): boolean {
  return true; // All roles can create assets
}

export function canUpdateAssets(role: string): boolean {
  return true; // All roles can update assets
}

export function canViewAssets(role: string): boolean {
  return true; // All roles can view assets
}

// ─── College (institution) scoping ───────────────────────────────────────────
//
// Single owner of the tenant-isolation policy: admins may operate across all
// colleges; every other role is locked to the college on their session.
// Every API route must scope data through these helpers instead of
// re-implementing the role checks inline.

/**
 * Parse an admin-supplied collegeId filter (from a query param or body).
 * Returns null for "all colleges" (admins only) and throws for malformed
 * values, so callers can reject them instead of building a NaN query.
 */
export function parseCollegeIdParam(
  value: string | null | undefined
): number | null {
  if (value === null || value === undefined || value === '' || value === 'all') {
    return null;
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed) || parsed <= 0) {
    throw new Error('Invalid collegeId');
  }
  return parsed;
}

/**
 * Resolve the college filter for a list query. Non-admins are always locked
 * to their own college regardless of what they requested; admins get either
 * the requested college or null (= all colleges).
 */
export function resolveCollegeFilter(
  user: Pick<SessionUser, 'role' | 'collegeId'>,
  requestedCollegeId: string | null | undefined
): number | null {
  if (user.role !== 'admin') {
    return user.collegeId;
  }
  return parseCollegeIdParam(requestedCollegeId);
}

/**
 * Whether a user may touch (read/write) a specific record that belongs to
 * `recordCollegeId`. The admin bypass is the only one; everything else is a
 * hard equality against the session college.
 */
export function canAccessCollege(
  user: Pick<SessionUser, 'role' | 'collegeId'>,
  recordCollegeId: number | null | undefined
): boolean {
  if (user.role === 'admin') return true;
  return recordCollegeId === user.collegeId;
}