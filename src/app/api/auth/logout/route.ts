import { NextRequest, NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/auth-jwt';
import { isKeycloakEnabled, buildLogoutUrl } from '@/lib/keycloak';
import { assertCsrf, CsrfError } from '@/lib/csrf';

// POST /api/auth/logout — clears the app session cookie. With Keycloak the
// response also carries the end-session URL so the client can terminate the
// SSO session too.
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

  await clearSessionCookie();

  if (isKeycloakEnabled()) {
    return NextResponse.json({
      message: 'Logged out successfully',
      logoutUrl: buildLogoutUrl(request.url),
    });
  }

  return NextResponse.json({ message: 'Logged out successfully' });
}