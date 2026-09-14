import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, auditLogs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getSession, hashPassword, verifyPassword } from '@/lib/auth-jwt';
import { validatePassword, ValidationError } from '@/lib/validation';
import { rateLimit, getClientIdentifier, RateLimitError } from '@/lib/rateLimit';
import { assertCsrf, CsrfError } from '@/lib/csrf';
import { logger, sanitizeError } from '@/lib/logger';

// POST /api/auth/change-password — authenticated user changes their own
// password. Success bumps sessionVersion, which revokes every existing
// session (see getSession), so the user must sign in again.
export async function POST(request: NextRequest) {
  try {
    assertCsrf(request);
  } catch (error) {
    if (error instanceof CsrfError) {
      return NextResponse.json(
        { error: 'Cross-origin request blocked' },
        { status: 403 }
      );
    }
    throw error;
  }

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const clientId = getClientIdentifier(request);
    await rateLimit(`change-password:${clientId}`, { windowMs: 60000, maxRequests: 5 });

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Current and new password are required' },
        { status: 400 }
      );
    }

    const rows = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const user = rows[0];

    // SSO accounts have no local password — it lives in the identity provider.
    if (!user.passwordHash) {
      return NextResponse.json(
        { error: 'This account signs in through single sign-on. Manage your password in the identity provider.' },
        { status: 400 }
      );
    }

    const isValid = await verifyPassword(currentPassword, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 400 }
      );
    }

    validatePassword(newPassword);

    const hashed = await hashPassword(newPassword);
    await db
      .update(users)
      .set({
        passwordHash: hashed,
        sessionVersion: user.sessionVersion + 1, // revoke all sessions
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    await db.insert(auditLogs).values({
      userId: user.id,
      action: 'UPDATE',
      entityType: 'user',
      entityId: user.id,
      changes: JSON.stringify({ passwordChanged: true }),
    });

    logger.info('Password changed', { userId: user.id });

    return NextResponse.json({ message: 'Password updated. Please sign in again.' });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: 'Too many attempts. Please try again later.', retryAfter: error.retryAfter },
        { status: 429, headers: { 'Retry-After': error.retryAfter.toString() } }
      );
    }

    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    logger.error('Error changing password', { error });
    return NextResponse.json({ error: sanitizeError(error) }, { status: 500 });
  }
}