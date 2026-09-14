# Security Documentation

## ✅ Security Measures Implemented

### 1. Input Validation & Sanitization
- **Server-side validation** of all inputs using custom validators (`src/lib/validation.ts`)
- **String sanitization** with max length limits
- **Type validation** for enums (status, category)
- **Date validation** with business logic checks
- **Cross-field validation** (e.g., warranty after purchase date, lab-belongs-to-college)

### 2. Rate Limiting
- **GET requests**: 60 requests/minute per IP
- **POST/PUT requests**: 20 requests/minute per IP
- **DELETE requests**: 10 requests/minute per IP
- **Login**: per-account throttle (5 attempts / 15 minutes) on top of the per-IP limit
- Returns `429 Too Many Requests` with `Retry-After` header
- **Store**: Redis when `REDIS_URL` is set (shared across instances), in-memory
  otherwise; the limiter degrades to memory if Redis is unreachable
- **Spoof-proofing**: `X-Forwarded-For` is honored only when `TRUST_PROXY=true`
  (behind a proxy that overwrites it); otherwise all direct clients share one
  bucket, so a spoofed IP can never escape throttling

### 3. Authentication & Authorization
- **JWT session authentication** (jose) stored in HTTP-only cookies
- **bcrypt password hashing** (cost factor 12)
- **Role-based access control**: admin, main_technician, technician
- **College isolation**: non-admin users are locked to their institution's data
- **Sessions expire after 7 days**; the cookie is `secure` when `NODE_ENV=production`
- **DB-backed session validation**: every request checks the account is still active and
  matches its `sessionVersion`, so disabling an account or resetting a password revokes
  existing sessions immediately (no waiting for token expiry)
- **Optional Keycloak OIDC SSO** (`AUTH_PROVIDER=keycloak`): full authorization-code flow
  with PKCE, state + nonce validation, and ID-token signature verification against the
  realm's remote JWKS. Keycloak authenticates only — role, college, lab and active state
  stay authoritative in the local database, under admin control
- **Fail-fast secret guard**: production startup throws unless `JWT_SECRET` is set and
  ≥ 32 chars (a missing secret can never silently fall back to a known default)

### 4. Secure Logging
- **No sensitive data** logged in production
- **Structured logging** with context
- **Error sanitization** prevents stack trace leaks
- Production errors show generic messages only

### 5. Pagination
- **Default limit**: 50 items per page (max 100)
- **Prevents memory exhaustion** from large datasets
- Query parameters validated and capped

### 6. SQL Injection Protection
- **Drizzle ORM** parameterizes all queries
- No raw SQL with user input
- All inputs validated before database operations

### 7. Error Handling
- **Custom error classes** for different error types
- **HTTP status codes** properly set (400, 401, 404, 429, 500)
- **No stack traces** exposed to clients in production

## ⚠️ Production Recommendations

### Critical (Must Do):

1. **Set a Strong JWT_SECRET**
   ```bash
   # Add to .env or environment variables
   JWT_SECRET=$(openssl rand -base64 32)
   ```
   Authentication is built in (JWT sessions, HTTP-only cookies). The code falls back to a known default in development — production must override it.

3. **Use HTTPS Only**
   - Set `secure` cookies
   - Enable HSTS headers
   - Force HTTPS redirects

4. **Configure CORS** (only if the API is consumed cross-origin)
   ```typescript
   // next.config.ts
   headers: async () => [{
     source: '/api/:path*',
     headers: [
       { key: 'Access-Control-Allow-Origin', value: 'https://yourdomain.com' },
     ],
   }],
   ```

5. **Set TRUST_PROXY correctly**
   - Behind Vercel/nginx/a load balancer: `TRUST_PROXY=true` so per-IP limits
     use the real client IP from `X-Forwarded-For`
   - Directly reachable: leave it unset — the header is spoofable and is ignored

### Highly Recommended:

6. **Review Authentication**
   - JWT session auth ships built in; review role assignments and secret rotation
   - Consider adding multi-factor authentication for admin accounts

7. **Scale Rate Limiting**
   - Set `REDIS_URL` to share rate-limit state across instances (built in —
     see `src/lib/rateLimit.ts`)
   - Implement different tiers for authenticated users if needed

8. **Audit Logging**
   - The borrowing lifecycle (requests, approvals, returns), user administration,
     and asset create/update/delete (field-level diffs, delete snapshots) all
     write to `audit_logs` via `src/lib/audit.ts`
   - Consider adding lab create/update/delete entries too

9. **Database Security**
   - Use connection pooling
   - Enable SSL/TLS for database connections
   - Encrypt sensitive data at rest
   - Regular backups with encryption

10. **Request Size Limits (built in)**
    - `src/middleware.ts` rejects API bodies over `MAX_REQUEST_SIZE` (default 1mb)
      with 413 before handlers parse them
    - Server Action bodies are capped by `bodySizeLimit` in `next.config.ts`

11. **Security Headers (built in)**
    - `next.config.ts` sends CSP, HSTS, `X-Frame-Options`, `nosniff`,
      `Referrer-Policy`, and `Permissions-Policy` on every response
    - The CSP allows no third-party script origins; adjust in one place if a
      integration ever needs one

12. **Implement Monitoring**
    - Set up error tracking (Sentry, Rollbar)
    - Monitor rate limit hits
    - Alert on suspicious activity
    - Track API usage patterns

13. **Add Request Validation Middleware**
    - Validate request content types
    - Check request size before parsing
    - Implement request timeout

14. **Dependency Security**
    ```bash
    # Regular security audits
    npm audit
    npm audit fix
    
    # Use Dependabot or Renovate for automated updates
    ```

## 🔒 Environment Variables

### Required for Production:
```bash
# Database
DATABASE_URL=postgresql://user:password@host:port/db?sslmode=require

# Authentication
JWT_SECRET=your-secure-random-key-minimum-32-chars

# Optional: Keycloak SSO (defaults to local password login)
# AUTH_PROVIDER=keycloak
# KEYCLOAK_URL=https://auth.example.com/realms/your-realm
# KEYCLOAK_CLIENT_ID=lab-asset-app
# KEYCLOAK_CLIENT_SECRET=your-client-secret

# Node Environment
NODE_ENV=production

# Optional but recommended
LOG_LEVEL=error
ALLOWED_ORIGINS=https://yourdomain.com
```

### Generate a Secure JWT Secret:
```bash
# Linux/Mac
openssl rand -base64 32

# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## 🚨 Known Limitations (Current Implementation)

1. **In-Memory Rate Limiting by Default**
   - Without `REDIS_URL` the store resets on server restart and is not shared
     across instances
   - **Solution**: Set `REDIS_URL` for multi-instance deployments (built in)

2. **Lab CRUD operations are not audit-logged**
   - Asset create/update/delete, the borrowing lifecycle, and user
     administration all write to `audit_logs`; lab mutations do not yet

3. **Same-origin CSRF model**
   - State-changing routes reject cross-origin requests via Origin/Referer
     validation (`src/lib/csrf.ts`) rather than per-form tokens; clients that
     send neither header (non-browser tools) are not CSRF-able but also not
     token-checked

4. **No File Upload Validation**
   - If you add file uploads, validate file types and sizes
   - **Solution**: Use file upload libraries with validation

## 📋 Security Checklist

Before deploying to production:

- [ ] Set a strong `JWT_SECRET` environment variable
- [ ] Confirm session cookies are `secure` (NODE_ENV=production)
- [ ] Configure HTTPS/SSL certificates
- [ ] Set `REDIS_URL` (multi-instance) and `TRUST_PROXY=true` (behind a proxy)
- [ ] Add CORS configuration if consumed cross-origin
- [ ] Set `ALLOWED_ORIGINS` if the public origin differs from the internal host
- [ ] Set up error monitoring (Sentry)
- [ ] Verify security headers are present (`curl -I` your deployed URL)
- [ ] Enable database SSL connections
- [ ] Set up automated backups
- [ ] Review and update dependencies
- [ ] Implement logging and monitoring
- [ ] Create incident response plan
- [ ] Set up rate limit alerting
- [ ] Test API with security scanner (OWASP ZAP, etc.)
- [ ] Review code for hardcoded secrets
- [ ] Set up WAF (Web Application Firewall) if needed

## 🔍 Testing Security

### Manual Tests:
```bash
# Test rate limiting
for i in {1..100}; do curl http://localhost:3000/api/assets; done

# Test input validation
curl -X POST http://localhost:3000/api/assets \
  -H "Content-Type: application/json" \
  -d '{"name":"<script>alert(1)</script>","location":"test"}'

# Test SQL injection attempts
curl "http://localhost:3000/api/assets?search='; DROP TABLE assets; --"
```

### Automated Security Scanning:
```bash
# 67 automated tests (Vitest): session handling, tenant isolation,
# login throttling, and the full borrowing lifecycle
npm test

# Use npm audit
npm audit

# Use Snyk
npx snyk test

# Use OWASP ZAP for API testing
```

## 📞 Reporting Security Issues

If you discover a security vulnerability, please email security@yourdomain.com rather than using the issue tracker.

## 📚 Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security Best Practices](https://nextjs.org/docs/app/building-your-application/configuring/security-headers)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [PostgreSQL Security](https://www.postgresql.org/docs/current/security.html)
