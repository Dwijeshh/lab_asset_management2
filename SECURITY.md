# Security

## Implemented controls

- Local password sign-in uses bcrypt hashes. Optional Keycloak OIDC sign-in uses authorization code, PKCE, state, nonce, and ID token verification.
- Sessions use signed JWTs in HTTP-only, SameSite=Lax cookies. The cookie is marked Secure in production. Requests also check the database for account state and session version, so disabling an account or changing its password revokes existing sessions.
- Authorization helpers and API handlers scope non-admin users to their assigned institution. Admins can work across institutions.
- State-changing API handlers check Origin or Referer through `src/lib/csrf.ts`. Clients that send neither header are allowed; this is intended for non-browser clients.
- API routes use input validation, Drizzle parameterized queries, and rate limits. The rate-limit store is in memory by default and can use Redis through `REDIS_URL`.
- `next.config.ts` sets Content Security Policy and other response headers. `src/middleware.ts` rejects API requests whose `Content-Length` exceeds `MAX_REQUEST_SIZE` (default `1mb`).
- Asset, borrowing, and user administration mutations write audit records. Lab changes are not fully audit logged.

## Before exposing the app

1. Set a unique `JWT_SECRET` of at least 32 characters. Production startup rejects a missing or weak secret.
2. Use HTTPS, a secured PostgreSQL connection, and database backups.
3. Replace the sample accounts and `password123` password if the database was seeded. Do not run `npm run seed` against existing data: it deletes existing assets, users, labs, and institutions.
4. Set `TRUST_PROXY=true` only behind a proxy that overwrites `X-Forwarded-For`. For multiple instances, configure `REDIS_URL` so rate limits are shared. If Redis becomes unavailable, the app falls back to per-process memory limits.
5. Review `ALLOWED_ORIGINS` if the public origin differs from the origin seen by the app.
6. Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm audit` against the version being deployed. Review dependency advisories before release.

## Limitations

- The in-memory rate-limit store resets on restart and is not shared between instances.
- The API body-size check relies on `Content-Length`; it does not measure a streamed body without that header.
- Lab mutations do not have the same audit coverage as assets, borrowing, and user administration.
- The CSRF model checks browser Origin or Referer headers rather than per-form tokens.

Report a suspected vulnerability privately to the repository maintainer rather than posting exploit details in a public issue.
