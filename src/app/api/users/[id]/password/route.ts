import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, auditLogs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getSession, hashPassword } from '@/lib/auth-jwt';
import { rateLimit, getClientIdentifier, RateLimitError } from '@/lib/rateLimit';
import { logger, sanitizeError } from '@/lib/logger';
import { validatePassword, ValidationError } from '@/lib/validation';

// PUT /api/users/[id]/password — admin resets a user's password (local
// provider users only). Bumps sessionVersion so all of the user's existing
// sessions are revoked immediately.
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const clientId = getClientIdentifier(request);
    rateLimit(`users:password:${clientId}`, { windowMs: 60000, maxRequests: 20 });

    const { id } = await params;
    const userId = parseInt(id, 10);
    if (isNaN(userId) || userId <= 0) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

    const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const existing = rows[0];

    // SSO-linked accounts have no local password — it lives in Keycloak.
    if (!existing.passwordHash) {
      return NextResponse.json(
        { error: 'This account signs in through single sign-on. Manage its password in the identity provider.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const newPassword = validatePassword(body.newPassword);

    const hashed = await hashPassword(newPassword);
    await db
      .update(users)
      .set({
        passwordHash: hashed,
        sessionVersion: existing.sessionVersion + 1, // revoke all sessions
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    await db.insert(auditLogs).values({
      userId: session.user.id,
      action: 'UPDATE',
      entityType: 'user',
      entityId: userId,
      changes: JSON.stringify({ passwordReset: true }),
    });

    logger.info('Password reset by admin', { userId, byUserId: session.user.id });

    return NextResponse.json({ message: 'Password reset. The user must sign in again.' });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: error.retryAfter },
        { status: 429, headers: { 'Retry-After': error.retryAfter.toString() } }
      );
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    logger.error('Error resetting password', { error });
    return NextResponse.json({ error: sanitizeError(error) }, { status: 500 });
  }
}