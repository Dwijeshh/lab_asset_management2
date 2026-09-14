import { NextRequest, NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/auth-jwt';
import { isKeycloakEnabled, buildLogoutUrl } from '@/lib/keycloak';

// POST /api/auth/logout — clears the app session cookie. With Keycloak the
// response also carries the end-session URL so the client can terminate the
// SSO session too.
export async function POST(request: NextRequest) {
  await clearSessionCookie();

  if (isKeycloakEnabled()) {
    return NextResponse.json({
      message: 'Logged out successfully',
      logoutUrl: buildLogoutUrl(request.url),
    });
  }

  return NextResponse.json({ message: 'Logged out successfully' });
}