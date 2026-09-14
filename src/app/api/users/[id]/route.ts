import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, colleges, labs, auditLogs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getSession } from '@/lib/auth-jwt';
import { rateLimit, getClientIdentifier, RateLimitError } from '@/lib/rateLimit';
import { assertCsrf, CsrfError } from '@/lib/csrf';
import { logger, sanitizeError } from '@/lib/logger';

const ROLES = ['admin', 'main_technician', 'technician'];

// PUT /api/users/[id] — update role / college / lab / active state (admin only).
// Changes apply to existing sessions immediately (getSession reads the DB).
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const clientId = getClientIdentifier(request);
    await rateLimit(`users:put:${clientId}`, { windowMs: 60000, maxRequests: 20 });

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

    const body = await request.json();
    const changes: Record<string, string | number | boolean | null> = {};

    let role = existing.role;
    if (body.role !== undefined) {
      if (!ROLES.includes(body.role)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
      }
      role = body.role;
      if (role !== existing.role) changes.role = role;
    }

    let collegeId = existing.collegeId;
    if (body.collegeId !== undefined) {
      const parsed = parseInt(body.collegeId, 10);
      if (isNaN(parsed) || parsed <= 0) {
        return NextResponse.json({ error: 'Invalid college' }, { status: 400 });
      }
      const collegeRows = await db
        .select()
        .from(colleges)
        .where(eq(colleges.id, parsed))
        .limit(1);
      if (collegeRows.length === 0) {
        return NextResponse.json({ error: 'College not found' }, { status: 400 });
      }
      collegeId = parsed;
      if (collegeId !== existing.collegeId) changes.collegeId = collegeId;
    }

    let labId = existing.labId;
    if (body.labId !== undefined && body.labId !== null && body.labId !== '') {
      const parsed = parseInt(body.labId, 10);
      if (isNaN(parsed) || parsed <= 0) {
        return NextResponse.json({ error: 'Invalid lab' }, { status: 400 });
      }
      const labRows = await db.select().from(labs).where(eq(labs.id, parsed)).limit(1);
      if (labRows.length === 0) {
        return NextResponse.json({ error: 'Lab not found' }, { status: 400 });
      }
      if (labRows[0].collegeId !== collegeId) {
        return NextResponse.json(
          { error: 'Lab does not belong to the selected college' },
          { status: 400 }
        );
      }
      if (labId !== parsed) changes.labId = parsed;
      labId = parsed;
    } else if (body.labId === null || body.labId === '') {
      if (labId !== null) changes.labId = null;
      labId = null;
    } else if (collegeId !== existing.collegeId && labId !== null) {
      // College changed without an explicit lab: drop the lab if it belongs
      // to the old college.
      const labRows = await db.select().from(labs).where(eq(labs.id, labId)).limit(1);
      if (labRows.length > 0 && labRows[0].collegeId !== collegeId) {
        changes.labId = null;
        labId = null;
      }
    }

    let isActive = existing.isActive;
    if (body.isActive !== undefined) {
      if (typeof body.isActive !== 'boolean') {
        return NextResponse.json({ error: 'isActive must be a boolean' }, { status: 400 });
      }
      isActive = body.isActive;
      if (isActive !== existing.isActive) changes.isActive = isActive;
    }

    if (Object.keys(changes).length === 0) {
      return NextResponse.json({ message: 'No changes applied' });
    }

    await db
      .update(users)
      .set({ role, collegeId, labId, isActive, updatedAt: new Date() })
      .where(eq(users.id, userId));

    await db.insert(auditLogs).values({
      userId: session.user.id,
      action: 'UPDATE',
      entityType: 'user',
      entityId: userId,
      changes: JSON.stringify(changes),
    });

    logger.info('User updated', { userId, byUserId: session.user.id, changes });

    return NextResponse.json({ message: 'User updated', changes });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: error.retryAfter },
        { status: 429, headers: { 'Retry-After': error.retryAfter.toString() } }
      );
    }
    logger.error('Error updating user', { error });
    return NextResponse.json({ error: sanitizeError(error) }, { status: 500 });
  }
}