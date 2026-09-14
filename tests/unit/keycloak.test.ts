import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createHash } from 'crypto';
import {
  isKeycloakEnabled,
  getKeycloakConfig,
  generateOAuthState,
  generateCodeVerifier,
  codeChallenge,
  buildAuthorizeUrl,
  buildLogoutUrl,
} from '@/lib/keycloak';

const OLD_ENV = { ...process.env };

describe('keycloak provider switch', () => {
  afterAll(() => {
    process.env = { ...OLD_ENV };
  });

  it('is disabled unless AUTH_PROVIDER=keycloak', () => {
    delete process.env.AUTH_PROVIDER;
    expect(isKeycloakEnabled()).toBe(false);
    process.env.AUTH_PROVIDER = 'local';
    expect(isKeycloakEnabled()).toBe(false);
  });

  it('is enabled with AUTH_PROVIDER=keycloak', () => {
    process.env.AUTH_PROVIDER = 'keycloak';
    expect(isKeycloakEnabled()).toBe(true);
  });

  it('throws when required config is missing', () => {
    process.env.AUTH_PROVIDER = 'keycloak';
    delete process.env.KEYCLOAK_URL;
    delete process.env.KEYCLOAK_CLIENT_ID;
    delete process.env.KEYCLOAK_CLIENT_SECRET;
    expect(() => getKeycloakConfig()).toThrow(/KEYCLOAK_URL/);
  });
});

describe('PKCE', () => {
  it('produces a deterministic S256 challenge for a verifier', () => {
    const verifier = generateCodeVerifier();
    const expected = createHash('sha256').update(verifier).digest().toString('base64url');
    expect(codeChallenge(verifier)).toBe(expected);
    expect(codeChallenge(verifier)).not.toBe(codeChallenge(generateCodeVerifier()));
  });

  it('generates distinct state and verifier values', () => {
    expect(generateOAuthState()).not.toBe(generateOAuthState());
    expect(generateCodeVerifier()).not.toBe(generateCodeVerifier());
  });
});

describe('authorize URL', () => {
  beforeAll(() => {
    process.env.KEYCLOAK_URL = 'https://auth.example.com/realms/mahe';
    process.env.KEYCLOAK_CLIENT_ID = 'lab-asset-app';
    process.env.KEYCLOAK_CLIENT_SECRET = 'secret';
  });

  afterAll(() => {
    process.env = { ...OLD_ENV };
  });

  it('builds an authorization-code + PKCE URL with state as nonce', () => {
    const state = generateOAuthState();
    const url = new URL(buildAuthorizeUrl('http://localhost:3112/api/auth/login', state, 'challenge'));
    expect(url.origin + url.pathname).toBe(
      'https://auth.example.com/realms/mahe/protocol/openid-connect/auth'
    );
    expect(url.searchParams.get('client_id')).toBe('lab-asset-app');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toBe('openid email profile');
    expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:3112/api/auth/callback');
    expect(url.searchParams.get('state')).toBe(state);
    expect(url.searchParams.get('nonce')).toBe(state);
    expect(url.searchParams.get('code_challenge')).toBe('challenge');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('builds the logout URL with the login page as post-logout redirect', () => {
    const url = new URL(buildLogoutUrl('http://localhost:3112/api/auth/logout'));
    expect(url.pathname).toContain('/protocol/openid-connect/logout');
    expect(url.searchParams.get('client_id')).toBe('lab-asset-app');
    expect(url.searchParams.get('post_logout_redirect_uri')).toBe('http://localhost:3112/login');
  });
});