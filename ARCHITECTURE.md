# System Architecture & Security Layers

## Application Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Client (Browser)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  AssetList   │  │  AssetForm   │  │  SearchBar   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└────────────────────────────┬────────────────────────────────┘
                             │ HTTPS (Required for Production)
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Application Server                │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Security Middleware                      │   │
│  │  • Rate Limiting (60/20/10 req/min)                   │   │
│  │  • Input Validation & Sanitization                    │   │
│  │  • JWT Session Authentication (required)              │   │
│  │  • Error Sanitization                                 │   │
│  └──────────────────────────────────────────────────────┘   │
│                             │                                │
│                             ▼                                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                  API Routes                           │   │
│  │                                                        │   │
│  │  GET    /api/assets       - List assets (paginated)  │   │
│  │  POST   /api/assets       - Create asset             │   │
│  │  GET    /api/assets/[id]  - Get single asset         │   │
│  │  PUT    /api/assets/[id]  - Update asset             │   │
│  │  DELETE /api/assets/[id]  - Delete asset             │   │
│  │  GET    /api/health       - Health check             │   │
│  └──────────────────────────────────────────────────────┘   │
│                             │                                │
│                             ▼                                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Drizzle ORM Layer                        │   │
│  │  • Parameterized Queries                             │   │
│  │  • Type Safety                                       │   │
│  │  • SQL Injection Protection                          │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────┘
                             │ SSL/TLS (sslmode=require)
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    PostgreSQL Database                       │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Table: assets                                        │   │
│  │  • id (serial, primary key)                          │   │
│  │  • name, category, manufacturer, model               │   │
│  │  • serialNumber, location, status                    │   │
│  │  • purchaseDate, warrantyExpiry                      │   │
│  │  • notes                                             │   │
│  │  • createdAt, updatedAt                              │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Security Layers (Defense in Depth)

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: Network Security (Production)                       │
│  ❌ Not configured (requires manual setup)                   │
│  • HTTPS/TLS                                                 │
│  • Firewall rules                                            │
│  • DDoS protection                                           │
│  • WAF (Web Application Firewall)                           │
└─────────────────────────────────────────────────────────────┘
                             ▼
┌──────────────────────────────────────────────────────────────┐
│ Layer 2: Authentication & Authorization                      │
│  ✅ Fully implemented and enabled                             │
│  • JWT sessions in HTTP-only cookies (jose, bcryptjs)        │
│  • Roles: admin, main_technician, technician                 │
│  • College isolation enforced per role                       │
└──────────────────────────────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 3: Rate Limiting & Body Size                           │
│  ✅ Fully implemented                                        │
│  • GET: 60 requests/minute per IP                           │
│  • POST/PUT: 20 requests/minute per IP                      │
│  • DELETE: 10 requests/minute per IP                        │
│  • Login: 5/15min per account on top of per-IP limits       │
│  • Returns 429 with Retry-After header                      │
│  • Redis store when REDIS_URL is set, memory otherwise      │
│  • API bodies capped (413 over MAX_REQUEST_SIZE, 1mb)       │
└─────────────────────────────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 4: Input Validation                                    │
│  ✅ Fully implemented                                        │
│  • Required field validation                                 │
│  • Type validation (string, enum, date)                     │
│  • Length limits enforced (255 chars for most fields)       │
│  • Enum validation (status, category)                       │
│  • Date validation (format, logic)                          │
│  • Cross-field validation                                   │
│  • String sanitization (trim, max length)                   │
└─────────────────────────────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 5: SQL Injection Protection                            │
│  ✅ Fully implemented                                        │
│  • Drizzle ORM with parameterized queries                   │
│  • No raw SQL with user input                               │
│  • Type-safe database operations                            │
│  • Input validation before DB operations                    │
└─────────────────────────────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 6: Error Handling                                      │
│  ✅ Fully implemented                                        │
│  • Safe error messages in production                         │
│  • No stack traces exposed to clients                       │
│  • Secure logging (no sensitive data)                       │
│  • Proper HTTP status codes                                 │
└─────────────────────────────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 7: Resource Protection                                 │
│  ✅ Implemented                                              │
│  • Pagination (max 100 items per request)                   │
│  • ID validation (positive integers only)                   │
│  • Request size limits (ready to configure)                 │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow - Asset Creation

```
1. User fills form
   └─> Client-side validation (basic)

2. POST /api/assets
   └─> HTTPS (production)
   └─> Rate limit check (20 req/min)
       ├─> ✅ Pass: Continue
       └─> ❌ Fail: Return 429

3. JWT session check
   └─> Verify session cookie, load user + role
       ├─> ✅ Authenticated: Continue
       └─> ❌ Not logged in: Return 401

4. Input validation
   └─> validateAssetInput(body)
       ├─> Check required fields (name, location, category)
       ├─> Validate types and enums
       ├─> Sanitize strings (trim, max length)
       ├─> Validate dates
       ├─> Cross-field validation
       ├─> ✅ Valid: Continue
       └─> ❌ Invalid: Return 400 with error message

5. Database operation
   └─> Drizzle ORM insert (parameterized)
       ├─> ✅ Success: Return 201 with asset data
       └─> ❌ Error: Log error, return 500

6. Logging
   └─> Log asset creation (safe, no sensitive data)
```

## Current Security Status

### ✅ Secure (Implemented)
- JWT session authentication (HTTP-only cookies, bcrypt passwords)
- Multi-tenant college isolation (single policy owner in auth-jwt.ts)
- Input validation & sanitization
- Rate limiting (per-route; Redis when REDIS_URL is set)
- CSRF protection (same-origin validation on all state-changing routes)
- Security headers (CSP, HSTS, X-Frame-Options, nosniff)
- Request body size limit (middleware)
- SQL injection protection
- XSS protection
- Error sanitization (no internal errors reach clients)
- Audit logging (borrowing lifecycle, user administration, asset CRUD with field-level diffs)
- Secure logging
- Pagination & ID validation
- Optional Keycloak OIDC SSO (PKCE + remote-JWKS verification)
- Admin user management with immediate session revocation
- Per-account login throttling (on top of per-IP limits)
- Committed database migrations with drift detection

### ❌ Not Configured (Requires Setup)
- HTTPS/SSL (platform-dependent)
- CORS policy (only if the API is consumed cross-origin)
- Redis store (set REDIS_URL for multi-instance)

## Deployment Models

### Option A: Development (Current)
```
✅ Localhost HTTP
✅ JWT session auth
✅ College isolation enforced
✅ Basic security features
❌ Not for public access
```

### Option B: Internal Lab (Minimum Security)
```
✅ HTTPS with self-signed cert
✅ JWT session authentication (built in)
✅ CSRF protection + security headers (built in)
✅ Behind firewall
✅ All security features active
⚠️ Single server instance
```

### Option C: Production (Full Security)
```
✅ HTTPS with valid certificate
✅ JWT session authentication (built in)
⚠️ Redis-backed rate limiting (set REDIS_URL for multi-instance)
⚠️ CORS configured (ALLOWED_ORIGINS, cross-origin consumers only)
✅ Audit logging
✅ Monitoring & alerting
✅ Multi-instance deployment
✅ Database backups
```

## Technology Stack

### Frontend
- **Framework**: Next.js 16 (React 19)
- **Styling**: Tailwind CSS 4
- **Language**: TypeScript 5.9

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Next.js API Routes
- **Validation**: Custom validators
- **Authentication**: JWT sessions (jose, bcryptjs); optional Keycloak OIDC SSO

### Database
- **Database**: PostgreSQL 14+
- **ORM**: Drizzle ORM 0.45
- **Migrations**: Committed Drizzle Kit migrations (idempotent baseline)

### Security
- **Rate Limiting**: Redis store (`REDIS_URL`) with in-memory fallback
- **CSRF**: Same-origin validation (`src/lib/csrf.ts`) on mutating routes
- **Headers**: CSP/HSTS/frame protection in `next.config.ts`
- **Input Validation**: Custom validators
- **SQL Protection**: Drizzle ORM parameterization
- **Error Handling**: Custom error classes

## File Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/                 (login, callback, logout, me, change-password)
│   │   ├── assets/               (list/create + [id] get/update/delete)
│   │   ├── labs/                 (list/create + [id] + [id]/assets)
│   │   ├── colleges/             (list)
│   │   ├── users/                (admin user mgmt + [id] password reset)
│   │   ├── asset-requests/       (borrow requests + [id] approve/reject)
│   │   ├── asset-loans/          (loan list + [id] return)
│   │   ├── notifications/        (list, mark read, read all)
│   │   └── health/               (health check)
│   ├── page.tsx                  (Dashboard)
│   ├── labs/                     (Lab list + lab detail pages)
│   ├── login/                    (Login page)
│   ├── users/                    (Admin user management page)
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── AppHeader.tsx             (Shared header + college switcher)
│   ├── AssetForm.tsx             (Create/Edit modal)
│   ├── AssetList.tsx             (Data table)
│   ├── SearchBar.tsx             (Search & filters)
│   ├── StatsCards.tsx            (Dashboard stats)
│   ├── BorrowRequestModal.tsx    (Borrow request + return date)
│   ├── PendingRequestsPanel.tsx  (Approve/reject queue)
│   ├── ActiveLoansPanel.tsx      (Loans + expected return)
│   ├── NotificationBell.tsx      (Notification bell)
│   └── CollegeSelector.tsx       (College switcher)
├── db/
│   ├── index.ts                  (DB connection)
│   └── schema.ts                 (Database schema)
├── middleware.ts                 (API body size limit → 413)
└── lib/
    ├── validation.ts             (Input validation ✅)
    ├── rateLimit.ts              (Rate limiting: Redis/memory ✅)
    ├── csrf.ts                   (Same-origin CSRF guard ✅)
    ├── audit.ts                  (Audit-trail helper ✅)
    ├── auth-jwt.ts               (JWT sessions + college scoping ✅)
    ├── keycloak.ts               (Keycloak OIDC client ✅)
    ├── assets.ts                 (Shared category/status metadata ✅)
    ├── useSession.ts             (Client session hook ✅)
    └── logger.ts                 (Secure logging ✅)

tests/                             (Vitest: unit + API integration suites)
drizzle/                           (Committed SQL migrations + Drizzle journal)

Documentation/
├── README.md                     (Overview, API reference & testing)
├── ARCHITECTURE.md               (This file)
├── SECURITY.md                   (Complete security analysis)
├── PRODUCTION_CHECKLIST.md       (Production readiness checklist)
├── DEPLOYMENT.md                 (Platform deployment guides)
├── RBAC_GUIDE.md                 (Roles & permissions reference)
├── LAB_HIERARCHY_GUIDE.md        (Multi-college data model)
├── CHANGELOG.md                  (Release history)
└── .env.example                  (Environment template)
```

## Security Testing

### Automated Tests
```bash
# Type safety
npm run typecheck

# Build validation
npm run build

# Test suite (unit + API integration: throttling, revocation, isolation)
npm test

# Security audit
npm audit
```

### Manual Security Tests
```bash
# Test rate limiting
for i in {1..100}; do curl localhost:3000/api/assets; done

# Test input validation
curl -X POST localhost:3000/api/assets \
  -H "Content-Type: application/json" \
  -d '{"name":"<script>alert(1)</script>","location":"lab"}'

# Test SQL injection
curl "localhost:3000/api/assets?search='; DROP TABLE assets; --"

# Test ID validation
curl localhost:3000/api/assets/abc
curl localhost:3000/api/assets/-1
```

## Monitoring Points

### Application Metrics
- Request rate (per endpoint)
- Response times
- Error rates
- Rate limit hits

### Security Metrics
- Failed login attempts
- Rate limit violations
- Invalid input attempts
- Database query performance

### Infrastructure Metrics
- CPU usage
- Memory usage
- Database connections
- Disk space
