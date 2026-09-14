// Keycloak OIDC client (authorization code + PKCE).
//
// Enabled with AUTH_PROVIDER=keycloak. KEYCLOAK_URL is the realm URL, e.g.
// https://auth.example.com/realms/mahe. The app keeps its own session cookie;
// Keycloak only authenticates the user (OIDC fronting), so all existing
// role/college middleware and the admin user-management UI are unchanged.
//
// The local users table stays authoritative for role, college, lab and
// active state: admins pre-provision accounts, and the first SSO login links
// the Keycloak subject id to that record.
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { randomBytes, createHash } from 'crypto';

export function isKeycloakEnabled(): boolean {
  return process.env.AUTH_PROVIDER === 'keycloak';
}

interface KeycloakConfig {
  realmUrl: string;
  clientId: string;
  clientSecret: string;
}

export function getKeycloakConfig(): KeycloakConfig {
  const realmUrl = (process.env.KEYCLOAK_URL || '').replace(/\/+$/, '');
  const clientId = process.env.KEYCLOAK_CLIENT_ID || '';
  const clientSecret = process.env.KEYCLOAK_CLIENT_SECRET || '';
  if (!realmUrl || !clientId || !clientSecret) {
    throw new Error(
      'AUTH_PROVIDER=keycloak requires KEYCLOAK_URL, KEYCLOAK_CLIENT_ID and KEYCLOAK_CLIENT_SECRET'
    );
  }
  return { realmUrl, clientId, clientSecret };
}

// ─── PKCE + state ───────────────────────────────────────────────────────────

// Random URL-safe value used as both the OAuth state and the OIDC nonce.
export function generateOAuthState(): string {
  return randomBytes(32).toString('base64url');
}

export function generateCodeVerifier(): string {
  return randomBytes(48).toString('base64url'); // 64 chars, url-safe
}

export function codeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest().toString('base64url');
}

function originOf(requestUrl: string): string {
  return new URL(requestUrl).origin;
}

// ─── Endpoints ──────────────────────────────────────────────────────────────

export function buildAuthorizeUrl(
  requestUrl: string,
  state: string,
  challenge: string
): string {
  const { realmUrl, clientId } = getKeycloakConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${originOf(requestUrl)}/api/auth/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    nonce: state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  return `${realmUrl}/protocol/openid-connect/auth?${params.toString()}`;
}

export async function exchangeCode(
  requestUrl: string,
  code: string,
  codeVerifier: string
): Promise<{ idToken: string; accessToken: string; refreshToken: string | null }> {
  const { realmUrl, clientId, clientSecret } = getKeycloakConfig();
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: `${originOf(requestUrl)}/api/auth/callback`,
    code_verifier: codeVerifier,
  });

  const response = await fetch(`${realmUrl}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = (await response.text()).slice(0, 200);
    throw new Error(`Keycloak token exchange failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  return {
    idToken: data.id_token as string,
    accessToken: data.access_token as string,
    refreshToken: data.refresh_token as string | null,
  };
}

// Verify the ID token signature (JWKS), issuer and audience, then check the
// nonce (bound to the state we set in the login cookie).
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export async function verifyIdToken(
  idToken: string,
  expectedNonce: string
): Promise<{ sub: string; email?: string; name?: string; preferredUsername?: string }> {
  const { realmUrl, clientId } = getKeycloakConfig();

  const jwksUrl = `${realmUrl}/protocol/openid-connect/certs`;
  let jwks = jwksCache.get(jwksUrl);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(jwksUrl));
    jwksCache.set(jwksUrl, jwks);
  }

  const { payload } = await jwtVerify(idToken, jwks, {
    issuer: realmUrl,
    audience: clientId,
  });

  if (payload.nonce !== expectedNonce) {
    throw new Error('Invalid OIDC nonce');
  }

  return {
    sub: payload.sub as string,
    email: payload.email as string | undefined,
    name: payload.name as string | undefined,
    preferredUsername: payload.preferred_username as string | undefined,
  };
}

export function buildLogoutUrl(requestUrl: string): string {
  const { realmUrl, clientId } = getKeycloakConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    post_logout_redirect_uri: `${originOf(requestUrl)}/login`,
  });
  return `${realmUrl}/protocol/openid-connect/logout?${params.toString()}`;
}