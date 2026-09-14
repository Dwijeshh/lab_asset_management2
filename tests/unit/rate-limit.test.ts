import { describe, it, expect } from 'vitest';
import { rateLimit, RateLimitError, getClientIdentifier } from '@/lib/rateLimit';

describe('rateLimit (in-memory path — no REDIS_URL in tests)', () => {
  it('allows requests up to the limit', async () => {
    for (let i = 0; i < 3; i++) {
      await rateLimit(`unit:allow:${Date.now()}:${i}`, { windowMs: 60_000, maxRequests: 3 });
    }
  });

  it('throws RateLimitError with a retry-after once the limit is exceeded', async () => {
    const key = `unit:over:${Date.now()}`;
    for (let i = 0; i < 5; i++) {
      await rateLimit(key, { windowMs: 60_000, maxRequests: 5 });
    }
    let caught: unknown = null;
    try {
      await rateLimit(key, { windowMs: 60_000, maxRequests: 5 });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(RateLimitError);
    expect((caught as RateLimitError).retryAfter).toBeGreaterThan(0);
  });

  it('resets after the window expires', async () => {
    const key = `unit:window:${Date.now()}`;
    await rateLimit(key, { windowMs: 200, maxRequests: 1 });
    await expect(rateLimit(key, { windowMs: 200, maxRequests: 1 })).rejects.toBeInstanceOf(
      RateLimitError
    );
    await new Promise((resolve) => setTimeout(resolve, 300));
    await rateLimit(key, { windowMs: 200, maxRequests: 1 }); // no throw
  });
});

describe('getClientIdentifier', () => {
  function req(headers: Record<string, string>): Request {
    return new Request('http://localhost/api/test', { headers });
  }

  it('ignores spoofable forwarding headers unless TRUST_PROXY is set', () => {
    process.env.TRUST_PROXY = '';
    expect(getClientIdentifier(req({ 'X-Forwarded-For': '1.2.3.4' }))).toBe('direct');
    expect(getClientIdentifier(req({ 'X-Real-Ip': '1.2.3.4' }))).toBe('direct');
  });

  it('uses the proxy-provided client IP when TRUST_PROXY is enabled', () => {
    process.env.TRUST_PROXY = 'true';
    expect(getClientIdentifier(req({ 'X-Forwarded-For': '1.2.3.4, 10.0.0.1' }))).toBe('1.2.3.4');
    expect(getClientIdentifier(req({ 'X-Real-Ip': '5.6.7.8' }))).toBe('5.6.7.8');
  });
});
