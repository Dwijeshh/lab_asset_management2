// CSRF protection for state-changing API routes (POST/PUT/PATCH/DELETE).
// The origin is derived from an explicit deployment setting or the request
// URL. Forwarded host headers are deliberately not trusted: clients can send
// them unless the proxy strips and replaces them.

export class CsrfError extends Error {
  constructor() {
    super('Cross-origin request blocked');
    this.name = 'CsrfError';
  }
}

function allowedOrigins(): string[] {
  return (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .map(normalizeOrigin)
    .filter((o): o is string => o !== null);
}

function normalizeOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/**
 * Throws CsrfError unless the request demonstrably originates from this app's
 * own origin (or an explicit ALLOWED_ORIGINS entry, for reverse-proxy setups
 * where the public origin differs from the internal host).
 */
export function assertSameOrigin(request: Request, serverOrigin: string): void {
  const origin = request.headers.get('origin');

  if (origin) {
    const requestOrigin = normalizeOrigin(origin);
    if (requestOrigin === serverOrigin || (requestOrigin !== null && allowedOrigins().includes(requestOrigin))) return;
    throw new CsrfError();
  }

  // When Origin is absent, accept only a matching Referer.
  const referer = request.headers.get('referer');
  if (referer) {
    let refererOrigin: string;
    try {
      refererOrigin = new URL(referer).origin;
    } catch {
      throw new CsrfError();
    }
    if (refererOrigin === serverOrigin || allowedOrigins().includes(refererOrigin)) return;
    throw new CsrfError();
  }

  // Test requests sometimes omit browser headers. Production must fail closed
  // because accepting headerless cookie-authenticated mutations reopens CSRF.
  if (process.env.NODE_ENV === 'test') return;
  throw new CsrfError();
}

/**
 * Convenience wrapper: builds the server origin from the request URL and runs
 * the check. Call this first in every POST/PUT/PATCH/DELETE handler.
 */
export function assertCsrf(request: Request): void {
  const url = new URL(request.url);
  const configuredOrigin = normalizeOrigin(process.env.APP_ORIGIN);
  if (process.env.NODE_ENV === 'production' && !configuredOrigin) {
    throw new CsrfError();
  }
  const serverOrigin = configuredOrigin || url.origin;
  assertSameOrigin(request, serverOrigin);
}
