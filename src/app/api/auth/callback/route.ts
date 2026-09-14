import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq, or } from 'drizzle-orm';
import { createSessionToken, setSessionCookie } from '@/lib/auth-jwt';
import { logger } from '@/lib/logger';
import {
  isKeycloakEnabled,
  exchangeCode,
  verifyIdToken,
} from '@/lib/keycloak';

// GET /api/auth/callback — Keycloak redirects here after authentication.
//
// Validates state, exchanges the code (PKCE), verifies the ID token, links
// the subject to a locally provisioned account, and issues the app's own
// session cookie. Local users are pre-provisioned by admins (role, college,
// lab); Keycloak only authenticates.
export async function GET(request: NextRequest) {
  try {
    if (!isKeycloakEnabled()) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const oauthError = searchParams.get('error');

    const expectedState = request.cookies.get('oauth_state')?.value;
    const verifier = request.cookies.get('oauth_verifier')?.value;

    if (oauthError || !code || !state || !expectedState || !verifier || state !== expectedState) {
      logger.warn('SSO callback rejected', { reason: oauthError ?? 'state mismatch' });
      return NextResponse.redirect(new URL('/login?error=sso_failed', request.url));
    }

    const tokens = await exchangeCode(request.url, code, verifier);
    const claims = await verifyIdToken(tokens.idToken, state);

    const email = (claims.email || '').toLowerCase();
    if (!email || !claims.sub) {
      return NextResponse.redirect(new URL('/login?error=sso_failed', request.url));
    }

    // Link to a locally provisioned account (by subject, then by email).
    const rows = await db
      .select()
      .from(users)
      .where(or(eq(users.keycloakSub, claims.sub), eq(users.email, email)))
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.redirect(new URL('/login?error=not_provisioned', request.url));
    }
    const user = rows[0];

    if (!user.isActive) {
      return NextResponse.redirect(new URL('/login?error=disabled', request.url));
    }

    // Link the Keycloak subject and refresh the display name from the IdP.
    const name = claims.name || claims.preferredUsername || user.name;
    if (user.keycloakSub !== claims.sub || user.name !== name) {
      await db
        .update(users)
        .set({ keycloakSub: claims.sub, name, updatedAt: new Date() })
        .where(eq(users.id, user.id));
    }

    const token = await createSessionToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      collegeId: user.collegeId,
      labId: user.labId,
      sessionVersion: user.sessionVersion,
    });
    await setSessionCookie(token);

    logger.info('User logged in via SSO', { userId: user.id });

    const response = NextResponse.redirect(new URL('/', request.url));
    // Clear the one-time OAuth cookies.
    response.cookies.set('oauth_state', '', { maxAge: 0, path: '/' });
    response.cookies.set('oauth_verifier', '', { maxAge: 0, path: '/' });
    return response;
  } catch (error) {
    logger.error('SSO callback error', { error });
    return NextResponse.redirect(new URL('/login?error=sso_failed', request.url));
  }
}