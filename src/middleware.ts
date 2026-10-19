import { NextRequest, NextResponse } from 'next/server';

// Request-body size cap for API routes. Route handlers have no built-in body
// limit, so this runs before every /api request and rejects oversized bodies
// (a cheap DoS guard in front of the request.json() calls).
function maxBodyBytes(): number {
  const raw = process.env.MAX_REQUEST_SIZE; // e.g. "1mb", "512kb"
  const match = raw?.match(/^(\d+)(kb|mb)$/i);
  if (!match) return 1024 * 1024; // 1mb default
  const n = Number(match[1]);
  if (!Number.isSafeInteger(n) || n <= 0) return 1024 * 1024;
  const configured = n * (match[2].toLowerCase() === 'mb' ? 1024 * 1024 : 1024);
  return Math.min(configured, 8 * 1024 * 1024);
}

function requestBodyLimit(request: NextRequest): number {
  // The import preview endpoint accepts workbooks up to 8 MiB. Keep the
  // default API limit for every other endpoint.
  if (request.nextUrl.pathname === '/api/assets/import') return 8 * 1024 * 1024 + 64 * 1024;
  return maxBodyBytes();
}

export function middleware(request: NextRequest) {
  const contentLength = request.headers.get('content-length');
  if (contentLength !== null) {
    if (!/^\d+$/.test(contentLength)) {
      return NextResponse.json({ error: 'Invalid Content-Length' }, { status: 400 });
    }
    const length = Number(contentLength);
    if (!Number.isSafeInteger(length) || length > requestBodyLimit(request)) {
      return NextResponse.json({ error: 'Request body too large' }, { status: 413 });
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
