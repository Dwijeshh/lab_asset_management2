# Lab Asset Management System for MAHE

A comprehensive fullstack web application for managing laboratory equipment and resources across multiple engineering colleges, built with Next.js 16 (App Router), PostgreSQL, and Drizzle ORM.

**Built for:** Manipal Academy of Higher Education (MAHE) Engineering Colleges

## 🚀 **Ready to Deploy?**

**Choose Your Platform:**
- ⚡ **Vercel** - Free, 5 minutes
- 🚂 **Railway** - Database included, 3 minutes  
- 🎨 **Render** - Free tier available, 10 minutes

[📖 Full Deployment Guide](./DEPLOYMENT.md)

## ✨ Key Features

### 👥 Role-Based Access Control (RBAC)
- **3 User Roles**: Admin, Main Technician, Technician
- **Permission-based actions**: Create labs (Admin/Main Tech only), Delete assets (Admin/Main Tech only)
- **Multi-college support**: MIT, KMC, MCODS, and more
- **Secure authentication**: JWT-based with HTTP-only cookies

### 🏢 Multi-College & Lab Architecture
- Support for multiple colleges under MAHE
- College-specific data isolation
- **Lab dashboard system** - Individual dashboard per lab
- **Lab hierarchy** - One Main Technician per lab with Technicians under them
- Lab organization by department and location
- Scalable to entire MAHE network

### 🔄 Asset Borrowing & Transfers
- Technicians request to borrow (temporary) or permanently receive assets from other labs in their college
- Proposed return date on requests; approvers can override it
- Approval creates a loan; returning a loan frees the asset automatically
- Overdue highlighting on active loans past their expected return date
- In-app notifications for requests, approvals, rejections, and returns
- Audit trail of every request, decision, and return

### 🔬 Asset Management
- ✅ Create, read, update, and delete lab assets
- 🔍 Search and filter assets by name, serial number, manufacturer, or location
- 📊 Real-time statistics dashboard showing total assets, available, in use, and under maintenance
- 🏷️ Categorize assets (laptops, monitors, printers, oscilloscopes, 3D printers, etc.)
- 🏭 Lab-specific asset tracking

### Asset Tracking
- **Status Management**: Track asset status (Available, In Use, Maintenance, Retired)
- **Location Tracking**: Monitor where each asset is located within the lab
- **Serial Numbers**: Track unique identifiers for each piece of equipment
- **Warranty Management**: Record purchase dates and warranty expiry dates

### User Interface
- 📱 Responsive design that works on desktop, tablet, and mobile
- 🎨 Clean, modern UI with Tailwind CSS
- 🔢 Interactive data tables with modal-based editing
- 📈 Visual statistics cards for quick overview

## Technology Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL with Drizzle ORM
- **Styling**: Tailwind CSS 4

## Database Schema

### Assets Table
- `id`: Unique identifier
- `name`: Asset name
- `category`: Equipment category (enum)
- `manufacturer`: Manufacturer name
- `model`: Model number
- `serialNumber`: Serial number
- `collegeId`: Owning college (kept in sync with the asset's lab)
- `labId`: Home lab (required)
- `location`: Location within the lab
- `status`: Current status (enum: available, in_use, maintenance, retired)
- `purchaseDate`: Date of purchase
- `warrantyExpiry`: Warranty expiration date
- `notes`: Additional notes
- `createdById` / `updatedById`: Who created / last updated the asset
- `createdAt`: Record creation timestamp
- `updatedAt`: Last update timestamp

The system also tracks `colleges`, `labs`, `users`, `asset_requests`, `asset_loans`, `notifications`, and `audit_logs`.

## API Endpoints

All endpoints require session authentication (JWT cookie from `/api/auth/login`).

### Auth
- `GET /api/auth/login` - SSO entry point (redirects to Keycloak when `AUTH_PROVIDER=keycloak`, otherwise reports `{ provider: 'local' }`)
- `POST /api/auth/login` - Local username/password login (disabled under SSO)
- `GET /api/auth/callback` - OIDC callback (Keycloak redirect target)
- `POST /api/auth/logout` - Log out (returns a `logoutUrl` under SSO to end the Keycloak session)
- `GET /api/auth/me` - Current user
- `POST /api/auth/change-password` - Change own password (verifies current password, revokes all sessions)

### User Management (admin only)
- `GET /api/users` - List users with college/lab names
- `POST /api/users` - Create user (name, email, role, college, lab, password)
- `PUT /api/users/[id]` - Update role / college / lab / active state
- `PUT /api/users/[id]/password` - Reset a user's password (revokes their sessions)

### Assets
- `GET /api/assets` - List (query: `search`, `status`, `category`, `collegeId`, `page`, `limit`)
- `POST /api/assets` - Create
- `GET|PUT|DELETE /api/assets/[id]`

### Labs & Colleges
- `GET /api/labs` - List (admins may filter by `collegeId`)
- `POST /api/labs` - Create (admin/main technician)
- `GET /api/labs/[id]` - Lab detail with team
- `GET /api/labs/[id]/assets` - Assets in a lab
- `GET /api/colleges` - Visible institutions (all for admins, own otherwise)

### Borrowing
- `GET /api/asset-requests` - Requests (scoped by role)
- `POST /api/asset-requests` - Create borrow/transfer request
- `PUT /api/asset-requests/[id]` - Approve/reject (admin/main technician)
- `GET /api/asset-loans` - Loans (scoped by role)
- `PUT /api/asset-loans/[id]` - Mark returned (admin/main technician)

### Notifications
- `GET /api/notifications` - List (query: `unread=true`)
- `PUT /api/notifications/[id]/read` - Mark one read
- `PUT /api/notifications/read-all` - Mark all read

### Health
- `GET /api/health`

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone <repository>
cd lab-asset-management
npm install
```

### 2. Setup Database

```bash
# Create PostgreSQL database
createdb app_db

# Set environment variable
echo "DATABASE_URL=postgresql://user:password@localhost:5432/app_db" > .env
echo "JWT_SECRET=$(openssl rand -base64 32)" >> .env

# Apply migrations
npm run db:migrate

# Seed with sample data (MAHE colleges, labs, and users)
npm run seed
```

### 3. Start Development Server

```bash
npm run dev
```

### 4. Login

Navigate to `http://localhost:3000/login` and use:

**Admin Account:**
- Email: `admin@manipal.edu`
- Password: `password123`

**Main Technician:**
- Email: `main.tech@manipal.edu`
- Password: `password123`

**Technician:**
- Email: `tech1@manipal.edu`
- Password: `password123`

## 📖 Usage by Role

### Administrator
1. **Full system access** across all labs
2. **View Labs**: Click "🏢 View Labs" to see all laboratory spaces
3. **Lab Dashboards**: Click any lab to view dedicated lab dashboard
4. **Create Labs**: Set up new laboratories for departments
5. **Manage Assets**: Create, edit, and delete any asset in any lab
6. **View Statistics**: Monitor utilization across all labs

### Main Technician (Lab Head)
1. **View Labs**: Access all labs in your college
2. **Lab Dashboard**: Dedicated dashboard for YOUR assigned lab
3. **Team View**: See technicians working under you
4. **Create Labs**: Set up new laboratory spaces
5. **Asset Control**: Full control over assets in your lab
6. **Lab Oversight**: Manage your lab's equipment and team

### Technician
1. **Add Assets**: Register new equipment to your assigned lab
2. **Update Assets**: Edit asset information and status
3. **Search & Filter**: Find specific equipment quickly
4. **View Statistics**: Monitor your lab's asset status
5. **Team Member**: Work under Main Technician's guidance

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Apply database migrations
npm run db:migrate

# Run the test suite
npm test
```

## 🧪 Testing

The test suite (Vitest) has two layers:

- **Unit tests** (`tests/unit/`) — validation rules, session token handling, the tenant-isolation policy helpers, the rate limiter, and the Keycloak OIDC client helpers.
- **API integration tests** (`tests/api/`) — run against the real app: the suite automatically builds and starts a test server (port 3112, next to your dev server) and drives the full HTTP surface: login throttling, session revocation on password changes, account disabling, tenant isolation, and the complete borrowing lifecycle.

```bash
npm test
```

The integration tests are idempotent — they create and clean up their own users and assets, and reject leftover pending requests. By default they run against your dev database; point `TEST_DATABASE_URL` at a scratch database (run `npm run db:migrate --force` and `npm run seed` against it first) for full isolation. `TEST_APP_PORT` overrides the server port.

CI runs typecheck, lint, database migrations, seed, build, and the test suite on `main` and every `feature/**` branch; the Vercel deploy only happens on `main` and only after tests pass.

## 🗄️ Database Migrations

Schema changes are versioned as committed Drizzle migrations in `drizzle/` (journal in `drizzle/meta/`), applied with `drizzle-kit migrate` and verified with `drizzle-kit check`. CI applies migrations and runs a drift check on every branch.

**Baseline:** `drizzle/0000_baseline.sql` is the full current schema, written idempotently (enums, tables, constraints, and indexes are `IF NOT EXISTS`/guarded) so it applies cleanly to both fresh databases and the pre-migrations database this repo already had. The one-time generation procedure lives in `drizzle.baseline.config.ts`.

**Making a schema change:**

```bash
# 1. Edit src/db/schema.ts
# 2. Generate the migration SQL (diff against the database)
npm run db:generate
# 3. Review the generated file in drizzle/, then apply it
npm run db:migrate
# 4. Confirm schema.ts and the database are in sync
npm run db:check
```

**Rollback:** Drizzle does not generate down-migrations. The safe rollback is a database restore from backup. For a hot-fix that only touches one migration, write a small SQL script that reverses it (e.g., `DROP COLUMN` / `ALTER TABLE ... DROP CONSTRAINT`), apply it with `psql`, and follow up with a corrective migration in the next change. Never hand-edit an already-applied migration file — the journal records its hash and `db:check` would report drift.

## 🔐 Single Sign-On (Keycloak)

Set `AUTH_PROVIDER=keycloak` with `KEYCLOAK_URL` (realm URL), `KEYCLOAK_CLIENT_ID` and `KEYCLOAK_CLIENT_SECRET` to enable OIDC SSO. The flow uses authorization code + PKCE:

1. `/login` redirects to Keycloak
2. Keycloak redirects back to `/api/auth/callback`, which validates the state/nonce, exchanges the code, and verifies the ID token signature via JWKS
3. The Keycloak subject is linked to a locally provisioned account (created by an admin under **User Management**); the app issues its own session cookie

Accounts are pre-provisioned locally (role, college, lab, active state stay under admin control); Keycloak only authenticates. SSO-linked users have no local password — password management for them lives in the identity provider.

## 🔐 Security & Roles

This system implements comprehensive RBAC (Role-Based Access Control):

### User Roles & Permissions

| Feature | Admin | Main Technician | Technician |
|---------|-------|----------------|------------|
| View Assets | ✅ | ✅ | ✅ |
| Create Assets | ✅ | ✅ | ✅ |
| Edit Assets | ✅ | ✅ | ✅ |
| Delete Assets | ✅ | ✅ | ❌ |
| Create Labs | ✅ | ✅ | ❌ |
| Manage Labs | ✅ | ✅ | ❌ |

### Security Features
- JWT-based authentication
- HTTP-only secure cookies
- Bcrypt password hashing
- Rate limiting on all endpoints
- Input validation and sanitization
- College-based data isolation

**📘 See [RBAC_GUIDE.md](./RBAC_GUIDE.md) for complete documentation**

## Environment Variables

Create a `.env` file with:
```bash
DATABASE_URL=postgresql://user:password@host:port/database
JWT_SECRET=your-secret-key-min-32-chars
NODE_ENV=development
```

Generate secure JWT secret:
```bash
openssl rand -base64 32
```

## 🔒 Security

This application includes production-ready security features:

- ✅ **Input Validation & Sanitization** - All user inputs validated and sanitized
- ✅ **Rate Limiting** - Protects against DoS attacks (60 req/min for reads, 20 for writes)
- ✅ **Pagination** - Prevents memory exhaustion from large datasets
- ✅ **SQL Injection Protection** - Drizzle ORM with parameterized queries
- ✅ **Secure Logging** - No sensitive data exposed in production logs
- ✅ **Error Handling** - Safe error messages, no stack traces to clients
- ✅ **JWT Session Authentication** - HTTP-only cookies, bcrypt hashing, role + college scoping

### ⚠️ IMPORTANT: Before Production

**This application is NOT production-ready by default.** See [SECURITY.md](./SECURITY.md) for:
- Complete security vulnerability assessment
- Production hardening checklist
- Required configuration changes (JWT_SECRET, HTTPS, Redis rate limiting)

**See [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md) for deployment guide.**

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [RBAC_GUIDE.md](./RBAC_GUIDE.md) | Role-based access control documentation |
| [LAB_HIERARCHY_GUIDE.md](./LAB_HIERARCHY_GUIDE.md) | Lab dashboard & hierarchy system guide |
| [SECURITY.md](./SECURITY.md) | Security features and vulnerability assessment |
| [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md) | Production deployment guide |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System architecture and design |
| [CHANGELOG.md](./CHANGELOG.md) | Release history |

## 🎓 MAHE Colleges Supported

- **MIT** - Manipal Institute of Technology (Engineering)
- **KMC** - Kasturba Medical College (Medicine)
- **MCODS** - Manipal College of Dental Sciences (Dentistry)
- **Scalable to all MAHE institutions**

## 🤝 Contributing

This project is designed for MAHE colleges. To add your college:

1. Follow the Quick Start above
2. Add your college via seed script or SQL
3. Create labs for your departments
4. Import your equipment data

## 📄 License

MIT

---

**Built with ❤️ for MAHE Engineering Colleges**

For support: Contact your system administrator or IT department
