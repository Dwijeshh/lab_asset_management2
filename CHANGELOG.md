# Changelog

All notable changes to the Lab Asset Management System.

## [2.1.0] - 2026 - Security Hardening, Borrowing Lifecycle & Cleanup

### 🔒 Security Fixes

- **Cross-college asset move closed**: asset PUT/POST now validates the
  TARGET lab's institution; technicians can no longer move assets across
  colleges, and `assets.collegeId` stays in sync with the lab.
- **No more internal error leakage**: `sanitizeError` never returns raw
  error messages (Drizzle embeds full SQL in them); malformed `collegeId`
  returns 400 instead of a raw database error.
- **PII scrubbed from logs**: removed email/password-adjacent console
  logging from the login flow (server and client) and the `details` field
  in authentication error responses.
- **Unified error handling**: all API routes now use the logger/
  sanitizeError/RateLimitError regime with per-route rate limits
  (borrowing and notification routes previously had none).

### 🔄 Borrowing Lifecycle (completed)

- Borrowers propose an expected return date on temporary loan requests
  (validated: temporary-only, must be in the future); approvers can
  override it, otherwise the proposal is inherited by the loan.
- Duplicate pending requests for the same asset are rejected with 409.
- Request approval is atomic — a double submit can no longer create two
  loans.
- `audit_logs` now records request creation, approve/reject decisions,
  and returns (with a computed overdue flag) — the table existed but was
  never written to before.
- Active Loans panel shows an Expected Return column with overdue
  highlighting; pending requests show the proposed date.
- Admin permanent transfers keep `assets.collegeId` in sync when moving
  an asset to another college.

### 🧹 Frontend Deduplication

- Single source of truth for category/status label & icon maps
  (`src/lib/assets.ts`) — was duplicated across three components.
- Shared `AppHeader` component and `useSession` hook replace three copies
  of the page header and session-fetch logic.
- Asset filtering is derived state (`useMemo`) instead of a mirrored
  `filteredAssets` state array.
- Net ~400 lines removed.

### 📚 Documentation

- Removed redundant docs: DEPLOY_NOW, QUICK_DEPLOY (duplicates of
  DEPLOYMENT.md), SECURITY_SUMMARY (duplicate of SECURITY.md),
  MIGRATION_GUIDE (v1→v2 upgrade that predates this repo's history), and
  GETTING_STARTED (duplicate of README Quick Start).
- README now documents all API endpoints including borrowing and
  notifications.

## [2.0.0] - 2024 - RBAC Release

### 🎉 Major Features Added

#### Role-Based Access Control (RBAC)
- **Three user roles**: Admin, Main Technician, Technician
- **Permission-based actions**: Different capabilities per role
- **JWT authentication**: Secure session management with HTTP-only cookies
- **Login system**: Dedicated login page with role-based dashboards

#### Multi-College Support
- **College management**: Support for multiple MAHE institutions
- **Data isolation**: Users only see their college's data
- **Scalable architecture**: Ready for all MAHE colleges

#### Lab Management
- **Lab CRUD operations**: Create and manage laboratory spaces
- **Hierarchical organization**: College → Labs → Assets
- **Location tracking**: Building, floor, room number
- **Capacity tracking**: Max students/users per lab

#### User Management
- **User accounts**: Email-based authentication
- **Role assignment**: Admin, Main Technician, Technician
- **Lab assignment**: Users can be assigned to specific labs
- **Employee tracking**: Employee ID field

#### Enhanced Asset Management
- **Lab-based assets**: All assets linked to labs
- **Creator tracking**: Track who created each asset
- **Update tracking**: Track who last updated each asset
- **College filtering**: Automatic filtering by user's college

### 🔐 Security Enhancements

- JWT-based authentication with bcryptjs hashing
- HTTP-only secure cookies
- Rate limiting on login endpoint (5 attempts/min)
- Input validation on all forms
- SQL injection protection via Drizzle ORM
- College-based data isolation
- Role-based route protection

### 📊 Database Changes

#### New Tables
- `colleges` - Institution information
- `labs` - Laboratory spaces
- `users` - User accounts with roles
- `audit_logs` - Change tracking (prepared for future)

#### Modified Tables
- `assets` - Added `lab_id`, `created_by_id`, `updated_by_id`

#### New Enums
- `user_role` - admin, main_technician, technician
- (Existing) `asset_status`, `asset_category`

### 🎨 UI Improvements

- Login page with demo credentials
- Role badge display
- Sign out functionality
- "Manage Labs" button (Admin/Main Tech only)
- Delete button visibility based on role
- Lab selector in asset form
- User name display

### 📦 New Dependencies

- `bcryptjs` - Password hashing
- `jose` - JWT token management
- `cookie` - Cookie parsing
- `tsx` - TypeScript execution for scripts

### 🛠️ New Scripts & Tools

- `npm run seed` - Seed database with sample data
- `src/scripts/seed.ts` - Seeding script for colleges, labs, users

### 📚 Documentation

#### New Documents
- `RBAC_GUIDE.md` - Complete RBAC documentation
- `GETTING_STARTED.md` - Setup guide for new users
- `MIGRATION_GUIDE.md` - Upgrade guide from v1.0
- `CHANGELOG.md` - This file

#### Updated Documents
- `README.md` - Updated with RBAC features
- `SECURITY.md` - Added authentication security
- `.env.example` - Added JWT_SECRET

### 🔄 API Changes

#### New Endpoints
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user
- `GET /api/labs` - List labs
- `POST /api/labs` - Create lab (Admin/Main Tech only)

#### Modified Endpoints
- `GET /api/assets` - Now requires authentication, filters by college
- `POST /api/assets` - Now requires authentication, adds creator tracking
- `PUT /api/assets/[id]` - Now requires authentication, adds updater tracking
- `DELETE /api/assets/[id]` - Now requires authentication + permission check

### ⚙️ Configuration Changes

- `JWT_SECRET` environment variable now required
- Session cookies enabled
- College-based data scoping

### 🎓 MAHE Integration

#### Pre-configured Colleges
- MIT - Manipal Institute of Technology
- KMC - Kasturba Medical College
- MCODS - Manipal College of Dental Sciences

#### Sample Labs (MIT)
- Advanced Materials Lab (Mechanical Engineering)
- Electronics & Communication Lab
- Computer Science Lab
- Chemical Engineering Lab

#### Sample Users
- Admin account for full access
- Main Technician for lab management
- Technicians for asset management

### 🐛 Bug Fixes

- Fixed asset creation without proper validation
- Fixed unrestricted delete operations
- Fixed missing audit trail
- Fixed security vulnerabilities from v1.0

### ⚠️ Breaking Changes

- **Authentication required**: All asset operations now require login
- **Lab assignment mandatory**: Assets must be assigned to a lab
- **Role permissions**: Technicians can no longer delete assets or create labs
- **College isolation**: Users can only see data from their college

### 🔄 Migration Path

Existing v1.0 users must:
1. Run `npx drizzle-kit push` to apply the schema changes
2. Create user accounts (see `npm run seed`)
3. Assign existing assets to labs
4. Update API clients to include authentication

## [1.0.0] - 2024 - Initial Release

### Features
- Basic asset CRUD operations
- Search and filter functionality
- Statistics dashboard
- Category-based organization
- Status tracking
- No authentication (anyone can access)

### Security (v1.0)
- Input validation
- Rate limiting
- SQL injection protection
- Error handling
- Pagination

---

## Upgrade Instructions

### From v1.0 to v2.x

**Key Steps:**
1. Backup database
2. Pull latest code
3. Add JWT_SECRET to .env
4. Run `npx drizzle-kit push`
5. Seed initial data
6. Create user accounts
7. Test thoroughly

### Environment Variables

**v1.0:**
```bash
DATABASE_URL=postgresql://...
```

**v2.0 (Added):**
```bash
DATABASE_URL=postgresql://...
JWT_SECRET=your-32-char-secret  # NEW
NODE_ENV=development            # NEW
```

## Future Roadmap

### v2.1 (Planned)
- [ ] User management UI (Admin only)
- [ ] Password reset functionality
- [ ] Email notifications
- [ ] Advanced search filters

### v2.2 (Planned)
- [ ] Asset maintenance scheduling
- [ ] QR code generation for assets
- [ ] Mobile-responsive improvements
- [ ] Export to PDF/Excel

### v3.0 (Future)
- [ ] Mobile app
- [ ] Advanced analytics
- [ ] SSO integration with MAHE
- [ ] Overdue loan reminders (scheduled jobs)

---

**For the latest updates, see the [GitHub repository](.)** 

**Built for MAHE Engineering Colleges with ❤️**
