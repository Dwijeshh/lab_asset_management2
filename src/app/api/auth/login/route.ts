import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyPassword, createSessionToken, setSessionCookie } from '@/lib/auth-jwt';
import { rateLimit, getClientIdentifier, RateLimitError } from '@/lib/rateLimit';
import { assertCsrf, CsrfError } from '@/lib/csrf';
import { logger, sanitizeError } from '@/lib/logger';
import {
  isKeycloakEnabled,
  buildAuthorizeUrl,
  generateOAuthState,
  generateCodeVerifier,
  codeChallenge,
} from '@/lib/keycloak';

// GET /api/auth/login
//
// With AUTH_PROVIDER=keycloak this starts the SSO flow by redirecting to
// Keycloak (PKCE + state/nonce cookies). With the local provider it returns
// a marker so the login page knows to render the password form.
export async function GET(request: NextRequest) {
  if (!isKeycloakEnabled()) {
    return NextResponse.json({ provider: 'local' });
  }

  const state = generateOAuthState();
  const verifier = generateCodeVerifier();
  const response = NextResponse.redirect(
    buildAuthorizeUrl(request.url, state, codeChallenge(verifier))
  );
  const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 600, // 10 minutes
    secure: process.env.NODE_ENV === 'production',
  };
  response.cookies.set('oauth_state', state, cookieOptions);
  response.cookies.set('oauth_verifier', verifier, cookieOptions);
  return response;
}

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
    if (isKeycloakEnabled()) {
      return NextResponse.json(
        { error: 'This system uses single sign-on. Please sign in with SSO.' },
        { status: 400 }
      );
    }

    // Rate limiting - strict for login (per IP, then per account below)
    const clientId = getClientIdentifier(request);
    await rateLimit(`auth:login:${clientId}`, { windowMs: 60000, maxRequests: 5 });

    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Per-account throttle: slows credential stuffing against a known email
    // even when the attacker rotates IPs.
    await rateLimit(`auth:login:email:${email.toLowerCase()}`, {
      windowMs: 15 * 60 * 1000,
      maxRequests: 5,
    });

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

    // SSO-linked accounts have no local password
    if (!user.passwordHash) {
      return NextResponse.json(
        { error: 'This account uses single sign-on. Please sign in with SSO.' },
        { status: 401 }
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
      sessionVersion: user.sessionVersion,
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