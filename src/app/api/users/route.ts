import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, colleges, labs, auditLogs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getSession } from '@/lib/auth-jwt';
import { hashPassword } from '@/lib/auth-jwt';
import { rateLimit, getClientIdentifier, RateLimitError } from '@/lib/rateLimit';
import { assertCsrf, CsrfError } from '@/lib/csrf';
import { logger, sanitizeError } from '@/lib/logger';
import { validateEmail, validatePassword, ValidationError } from '@/lib/validation';
import { isKeycloakEnabled } from '@/lib/keycloak';

const ROLES = ['admin', 'main_technician', 'technician'];

// GET /api/users — list users (admin only). passwordHash is never returned.
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const clientId = getClientIdentifier(request);
    await rateLimit(`users:get:${clientId}`, { windowMs: 60000, maxRequests: 60 });

    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        collegeId: users.collegeId,
        collegeName: colleges.name,
        labId: users.labId,
        labName: labs.name,
        isActive: users.isActive,
        keycloakLinked: users.keycloakSub,
        lastLogin: users.lastLogin,
        createdAt: users.createdAt,
      })
      .from(users)
      .leftJoin(colleges, eq(users.collegeId, colleges.id))
      .leftJoin(labs, eq(users.labId, labs.id))
      .orderBy(users.createdAt);

    return NextResponse.json({
      data: rows.map((row) => ({ ...row, keycloakLinked: row.keycloakLinked !== null })),
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: error.retryAfter },
        { status: 429, headers: { 'Retry-After': error.retryAfter.toString() } }
      );
    }
    logger.error('Error listing users', { error });
    return NextResponse.json({ error: sanitizeError(error) }, { status: 500 });
  }
}

// POST /api/users — create a user (admin only).
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
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const clientId = getClientIdentifier(request);
    await rateLimit(`users:post:${clientId}`, { windowMs: 60000, maxRequests: 20 });

    const body = await request.json();
    const { name, role, collegeId, labId, password } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    const email = validateEmail(body.email);
    if (!ROLES.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    const collegeIdNum = parseInt(collegeId, 10);
    if (isNaN(collegeIdNum) || collegeIdNum <= 0) {
      return NextResponse.json({ error: 'Invalid college' }, { status: 400 });
    }
    const collegeRows = await db
      .select()
      .from(colleges)
      .where(eq(colleges.id, collegeIdNum))
      .limit(1);
    if (collegeRows.length === 0) {
      return NextResponse.json({ error: 'College not found' }, { status: 400 });
    }

    let labIdNum: number | null = null;
    if (labId !== undefined && labId !== null && labId !== '') {
      labIdNum = parseInt(labId, 10);
      if (isNaN(labIdNum) || labIdNum <= 0) {
        return NextResponse.json({ error: 'Invalid lab' }, { status: 400 });
      }
      const labRows = await db
        .select()
        .from(labs)
        .where(eq(labs.id, labIdNum))
        .limit(1);
      if (labRows.length === 0) {
        return NextResponse.json({ error: 'Lab not found' }, { status: 400 });
      }
      if (labRows[0].collegeId !== collegeIdNum) {
        return NextResponse.json(
          { error: 'Lab does not belong to the selected college' },
          { status: 400 }
        );
      }
    }

    // Local provider: a password is mandatory. Keycloak: optional (the user
    // signs in through SSO and the account is linked on first login).
    let passwordHash: string | null = null;
    if (!isKeycloakEnabled()) {
      validatePassword(password);
      passwordHash = await hashPassword(password);
    } else if (password) {
      validatePassword(password);
      passwordHash = await hashPassword(password);
    }

    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (existing.length > 0) {
      return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 });
    }

    const inserted = await db
      .insert(users)
      .values({
        email,
        name: name.trim().slice(0, 255),
        role,
        collegeId: collegeIdNum,
        labId: labIdNum,
        passwordHash,
        isActive: true,
      })
      .returning({ id: users.id });

    await db.insert(auditLogs).values({
      userId: session.user.id,
      action: 'CREATE',
      entityType: 'user',
      entityId: inserted[0].id,
      changes: JSON.stringify({ email, role, collegeId: collegeIdNum, labId: labIdNum }),
    });

    logger.info('User created', { userId: inserted[0].id, byUserId: session.user.id });

    return NextResponse.json(
      { message: 'User created', id: inserted[0].id },
      { status: 201 }
    );
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
    logger.error('Error creating user', { error });
    return NextResponse.json({ error: sanitizeError(error) }, { status: 500 });
  }
}