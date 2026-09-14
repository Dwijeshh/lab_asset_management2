import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyPassword, createSessionToken, setSessionCookie } from '@/lib/auth-jwt';
import { rateLimit, getClientIdentifier, RateLimitError } from '@/lib/rateLimit';
import { logger, sanitizeError } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    // Rate limiting - strict for login
    const clientId = getClientIdentifier(request);
    rateLimit(`auth:login:${clientId}`, { windowMs: 60000, maxRequests: 5 });

    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Find user
    const userResult = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (userResult.length === 0) {
      // Generic error to prevent user enumeration
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const user = userResult[0];

    // Check if user is active
    if (!user.isActive) {
      return NextResponse.json(
        { error: 'Account is disabled' },
        { status: 403 }
      );
    }

    // Verify password
    const isValid = await verifyPassword(password, user.passwordHash);

    if (!isValid) {
      // No email in logs: failed attempts are an auth signal, not PII to retain
      logger.warn('Failed login attempt');
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Update last login
    await db
      .update(users)
      .set({ lastLogin: new Date() })
      .where(eq(users.id, user.id));

    // Create session token
    const token = await createSessionToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      collegeId: user.collegeId,
      labId: user.labId,
    });

    // Set cookie
    await setSessionCookie(token);

    logger.info('User logged in', { userId: user.id });

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        collegeId: user.collegeId,
        labId: user.labId,
      },
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again later.' },
        { 
          status: 429,
          headers: { 'Retry-After': error.retryAfter.toString() }
        }
      );
    }

    logger.error('Login error', { error });
    return NextResponse.json(
      { error: 'An error occurred during login' },
      { status: 500 }
    );
  }
}