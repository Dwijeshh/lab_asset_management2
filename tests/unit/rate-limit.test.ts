import { describe, it, expect } from 'vitest';
import { rateLimit, RateLimitError } from '@/lib/rateLimit';

function expectLimited(fn: () => void): RateLimitError {
  let caught: unknown = null;
  try {
    fn();
  } catch (error) {
    caught = error;
  }
  if (!caught) throw new Error('expected RateLimitError');
  expect(caught).toBeInstanceOf(RateLimitError);
  return caught as RateLimitError;
}

describe('rateLimit (in-memory path)', () => {
  it('allows requests up to the limit', () => {
    for (let i = 0; i < 3; i++) {
      rateLimit(`unit:allow:${i}`, { windowMs: 60_000, maxRequests: 3 });
    }
  });

  it('throws RateLimitError with a retry-after once the limit is exceeded', () => {
    const key = `unit:over:${Date.now()}`;
    for (let i = 0; i < 5; i++) {
      rateLimit(key, { windowMs: 60_000, maxRequests: 5 });
    }
    const error = expectLimited(() => rateLimit(key, { windowMs: 60_000, maxRequests: 5 }));
    expect(error.retryAfter).toBeGreaterThan(0);
  });

  it('resets after the window expires', async () => {
    const key = `unit:window:${Date.now()}`;
    rateLimit(key, { windowMs: 200, maxRequests: 1 });
    expectLimited(() => rateLimit(key, { windowMs: 200, maxRequests: 1 }));
    await new Promise((resolve) => setTimeout(resolve, 300));
    rateLimit(key, { windowMs: 200, maxRequests: 1 }); // no throw
  });
});