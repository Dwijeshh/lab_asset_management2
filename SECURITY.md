# Security Documentation

## ✅ Security Measures Implemented

### 1. Input Validation & Sanitization
- **Server-side validation** of all inputs using custom validators (`src/lib/validation.ts`)
- **String sanitization** with max length limits
- **Type validation** for enums (status, category)
- **Date validation** with business logic checks
- **Cross-field validation** (e.g., warranty after purchase date)

### 2. Rate Limiting
- **GET requests**: 60 requests/minute per IP
- **POST/PUT requests**: 20 requests/minute per IP
- **DELETE requests**: 10 requests/minute per IP
- Returns `429 Too Many Requests` with `Retry-After` header

### 3. Authentication & Authorization
- **JWT session authentication** (jose) stored in HTTP-only cookies
- **bcrypt password hashing** (cost factor 12)
- **Role-based access control**: admin, main_technician, technician
- **College isolation**: non-admin users are locked to their institution's data
- Sessions expire after 7 days; the cookie is `secure` when `NODE_ENV=production`

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

4. **Configure CORS**
   ```typescript
   // next.config.ts
   headers: async () => [{
     source: '/api/:path*',
     headers: [
       { key: 'Access-Control-Allow-Origin', value: 'https://yourdomain.com' },
     ],
   }],
   ```

5. **Add CSRF Protection**
   - Implement CSRF tokens for state-changing operations
   - Use SameSite cookies
   - Consider using Next.js middleware

### Highly Recommended:

6. **Review Authentication**
   - JWT session auth ships built in; review role assignments and secret rotation
   - Consider adding multi-factor authentication for admin accounts

7. **Upgrade Rate Limiting**
   - Replace in-memory store with Redis
   - Add distributed rate limiting for multiple servers
   - Implement different tiers for authenticated users

8. **Extend Audit Logging**
   - The borrowing lifecycle (requests, approvals, returns) is logged to `audit_logs`
   - Consider logging asset create/update/delete operations too

9. **Database Security**
   - Use connection pooling
   - Enable SSL/TLS for database connections
   - Encrypt sensitive data at rest
   - Regular backups with encryption

10. **Request Size Limits**
    ```typescript
    // next.config.ts
    experimental: {
      bodySizeLimit: '1mb',
    }
    ```

11. **Add CSP Headers**
    ```typescript
    // next.config.ts
    headers: async () => [{
      source: '/:path*',
      headers: [
        {
          key: 'Content-Security-Policy',
          value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline';"
        },
      ],
    }],
    ```

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

1. **In-Memory Rate Limiting**
   - Resets on server restart
   - Not suitable for multi-instance deployments
   - **Solution**: Use Redis or similar

2. **Client-Side Filtering**
   - Main list does client-side filtering after fetching all
   - **Solution**: Move filtering to server API calls

3. **No File Upload Validation**
   - If you add file uploads, validate file types and sizes
   - **Solution**: Use file upload libraries with validation

## 📋 Security Checklist

Before deploying to production:

- [ ] Set a strong `JWT_SECRET` environment variable
- [ ] Confirm session cookies are `secure` (NODE_ENV=production)
- [ ] Configure HTTPS/SSL certificates
- [ ] Set up Redis for rate limiting
- [ ] Add CORS configuration
- [ ] Enable CSRF protection
- [ ] Set up error monitoring (Sentry)
- [ ] Configure CSP headers
- [ ] Enable database SSL connections
- [ ] Set up automated backups
- [ ] Review and update dependencies
- [ ] Set up security headers (HSTS, X-Frame-Options, etc.)
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
