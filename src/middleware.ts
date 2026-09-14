import { NextRequest, NextResponse } from 'next/server';

// Request-body size cap for API routes. Route handlers have no built-in body
// limit, so this runs before every /api request and rejects oversized bodies
// (a cheap DoS guard in front of the request.json() calls).
function maxBodyBytes(): number {
  const raw = process.env.MAX_REQUEST_SIZE; // e.g. "1mb", "512kb"
  const match = raw?.match(/^(\d+)(kb|mb)$/i);
  if (!match) return 1024 * 1024; // 1mb default
  const n = parseInt(match[1], 10);
  return match[2].toLowerCase() === 'mb' ? n * 1024 * 1024 : n * 1024;
}

export function middleware(request: NextRequest) {
  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > maxBodyBytes()) {
    return NextResponse.json(
      { error: 'Request body too large' },
      { status: 413 }
    );
  }
  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
