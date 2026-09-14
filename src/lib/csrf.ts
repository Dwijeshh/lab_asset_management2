// CSRF protection for state-changing API routes (POST/PUT/PATCH/DELETE).
//
// The session cookie is httpOnly + sameSite=lax, which already blocks CSRF
// from other origins in practice (cross-origin POSTs don't carry the cookie,
// and lax only sends it on top-level GET navigations). This guard closes the
// remaining hole — browsers that ignore or mis-handle SameSite — by requiring
// that state-changing requests carry an Origin header matching the host the
// request was sent to. Unlike reading the cookie, this needs no client-side
// token: browsers always attach Origin to cross-site requests, so a forged
// POST from evil.example cannot pass (and cannot strip the header either —
// only fetch/XHR from our own origin may omit it, and then Referer covers it).
//
// Chosen over double-submit cookie tokens deliberately: it requires zero
// client changes and zero per-form wiring across 14 mutating routes.

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
    .filter(Boolean);
}

/**
 * Throws CsrfError unless the request demonstrably originates from this app's
 * own origin (or an explicit ALLOWED_ORIGINS entry, for reverse-proxy setups
 * where the public origin differs from the internal host).
 */
export function assertSameOrigin(request: Request, serverOrigin: string): void {
  const origin = request.headers.get('origin');

  if (origin) {
    if (origin === serverOrigin || allowedOrigins().includes(origin)) return;
    throw new CsrfError();
  }

  // No Origin header (same-origin fetch/XHR may omit it; some HTTP clients
  // never send it). Fall back to Referer, which browsers set on navigation-
  // initiated requests.
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

  // Neither header: an authenticated browser POST from our own UI always has
  // one of the two. Requests without both are non-browser clients (curl, the
  // test suite, service-to-service) — allowed, as they are not CSRF-able.
}

/**
 * Convenience wrapper: builds the server origin from the request URL and runs
 * the check. Call this first in every POST/PUT/PATCH/DELETE handler.
 */
export function assertCsrf(request: Request): void {
  const url = new URL(request.url);
  const forwardedHost = request.headers.get('x-forwarded-host');
  const proto = request.headers.get('x-forwarded-proto') || url.protocol.replace(':', '');
  const serverOrigin = forwardedHost
    ? `${proto}://${forwardedHost}`
    : url.origin;
  assertSameOrigin(request, serverOrigin);
}
