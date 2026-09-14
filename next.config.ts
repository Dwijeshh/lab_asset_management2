import type { NextConfig } from "next";

// Security headers applied to every response. Next.js serves these before any
// route code runs, so they hold for pages and API routes alike.
const securityHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // Strict CSP: Next.js needs 'unsafe-inline' for its inline bootstrap and
  // 'unsafe-eval' in dev (React Refresh). No external script origins are
  // allowed — the app loads no third-party JS.
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'" + (process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""),
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self'" + (process.env.KEYCLOAK_URL ? ` ${process.env.KEYCLOAK_URL}` : ""),
      "frame-ancestors 'self'",
      "form-action 'self'",
      "object-src 'none'",
      "base-uri 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  experimental: {
    serverActions: {
      // Cap Server Action bodies. API route bodies are capped separately in
      // middleware.ts (route handlers have no built-in limit).
      bodySizeLimit: "1mb",
    },
  },
};

export default nextConfig;
