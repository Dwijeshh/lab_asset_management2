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
│  │  • Rate Limiting (60/20/10 req/min)                  │   │
│  │  • Input Validation & Sanitization                   │   │
│  │  • API Key Authentication (optional)                 │   │
│  │  • Error Sanitization                                │   │
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
┌─────────────────────────────────────────────────────────────┐
│ Layer 2: Authentication & Authorization                      │
│  ✅ Implemented but ⚠️ DISABLED by default                   │
│  • API Key authentication (validateApiKey)                   │
│  • Ready to enable (just uncomment)                          │
│  • Supports Bearer token format                              │
└─────────────────────────────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 3: Rate Limiting                                       │
│  ✅ Fully implemented                                        │
│  • GET: 60 requests/minute per IP                           │
│  • POST/PUT: 20 requests/minute per IP                      │
│  • DELETE: 10 requests/minute per IP                        │
│  • Returns 429 with Retry-After header                      │
│  ⚠️ In-memory (upgrade to Redis for multi-instance)         │
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

3. Authentication check (if enabled)
   └─> API key validation
       ├─> ✅ Valid: Continue
       └─> ❌ Invalid: Return 401

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
- Input validation & sanitization
- Rate limiting (basic)
- SQL injection protection
- XSS protection
- Error handling
- Secure logging
- Pagination
- ID validation

### ⚠️ Ready but Disabled (Development Mode)
- API key authentication
  - Code: ✅ Complete
  - Status: ❌ Commented out
  - To enable: Uncomment `validateApiKey(request)` in API routes

### ❌ Not Configured (Requires Setup)
- HTTPS/SSL (platform-dependent)
- Security headers (CSP, HSTS, etc.)
- CORS policy
- CSRF protection
- Audit logging
- Redis-backed rate limiting
- User authentication (NextAuth.js)

## Deployment Models

### Option A: Development (Current)
```
✅ Localhost HTTP
✅ No authentication
✅ Basic security features
❌ Not for public access
```

### Option B: Internal Lab (Minimum Security)
```
✅ HTTPS with self-signed cert
✅ API key authentication enabled
✅ Behind firewall
✅ All security features active
⚠️ Single server instance
```

### Option C: Production (Full Security)
```
✅ HTTPS with valid certificate
✅ User authentication (NextAuth.js)
✅ Redis-backed rate limiting
✅ Security headers configured
✅ CORS configured
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
- **Authentication**: API Key (optional)

### Database
- **Database**: PostgreSQL 14+
- **ORM**: Drizzle ORM 0.45
- **Migrations**: Drizzle Kit

### Security
- **Rate Limiting**: In-memory (upgradable to Redis)
- **Input Validation**: Custom validators
- **SQL Protection**: Drizzle ORM parameterization
- **Error Handling**: Custom error classes

## File Structure

```
src/
├── app/
│   ├── api/
│   │   ├── assets/
│   │   │   ├── route.ts          (List & Create - secured ✅)
│   │   │   └── [id]/
│   │   │       └── route.ts      (Get, Update, Delete - secured ✅)
│   │   └── health/
│   │       └── route.ts          (Health check)
│   ├── page.tsx                  (Main UI)
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── AssetForm.tsx             (Create/Edit modal)
│   ├── AssetList.tsx             (Data table)
│   ├── SearchBar.tsx             (Search & filters)
│   └── StatsCards.tsx            (Dashboard stats)
├── db/
│   ├── index.ts                  (DB connection)
│   └── schema.ts                 (Database schema)
└── lib/
    ├── validation.ts             (Input validation ✅)
    ├── rateLimit.ts              (Rate limiting ✅)
    ├── auth.ts                   (Authentication ⚠️)
    └── logger.ts                 (Secure logging ✅)

Documentation/
├── README.md                     (Getting started)
├── SECURITY.md                   (Complete security analysis)
├── SECURITY_SUMMARY.md           (Quick reference)
├── PRODUCTION_CHECKLIST.md       (Deployment guide)
├── ARCHITECTURE.md               (This file)
└── .env.example                  (Environment template)
```

## Security Testing

### Automated Tests
```bash
# Type safety
npm run typecheck

# Build validation
npm run build

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
- Failed authentication attempts (when enabled)
- Rate limit violations
- Invalid input attempts
- Database query performance

### Infrastructure Metrics
- CPU usage
- Memory usage
- Database connections
- Disk space
