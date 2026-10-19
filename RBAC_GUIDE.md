# Role-Based Access Control (RBAC) Guide

## 🎯 Overview

The Lab Asset Management System now includes a comprehensive Role-Based Access Control (RBAC) system designed for MAHE (Manipal Academy of Higher Education) Engineering Colleges with multi-college scalability.

## 👥 User Roles

### 1. **Admin** (Highest Privileges)
- **Full system access**
- Can create and manage labs
- Can create, edit, and delete all assets
- Can manage users (future enhancement)
- Access to all labs across the college
- Intended for: Department Heads, Lab Coordinators

### 2. **Main Technician** (Mid-Level Privileges)
- Can create and manage labs
- Can create, edit, and delete assets
- Typically assigned to a specific lab
- Can work across multiple labs
- Intended for: Senior Lab Technicians, Lab Managers

### 3. **Technician** (Basic Privileges)
- Can view all assets
- Can create and edit assets
- **Cannot delete assets** (requires Admin/Main Technician)
- **Cannot create labs** (requires Admin/Main Technician)
- Typically assigned to a specific lab
- Intended for: Lab Technicians, Lab Assistants

## 🏢 Multi-College Architecture

### College Structure
The system is built to support multiple colleges under MAHE:

1. **MIT** - Manipal Institute of Technology
2. **KMC** - Kasturba Medical College
3. **MCODS** - Manipal College of Dental Sciences
4. *(More colleges can be added)*

### Lab Organization
Each lab belongs to a college and includes:
- **Name**: e.g., "Advanced Materials Lab"
- **Code**: Unique identifier (e.g., "MIT-LAB-001")
- **Department**: e.g., "Mechanical Engineering"
- **Location**: Building, floor, room number
- **Capacity**: Maximum students/users

### Asset Assignment
Each asset is:
- Linked to a specific **lab**
- Tracked by **location within the lab**
- Associated with **creator and last updater**
- Filtered by **college** (users only see their college's assets)

## 📊 Database Schema

### Tables

#### 1. **colleges**
- Stores college/institution information
- Fields: name, code, address, contact info
- Enables multi-college scaling

#### 2. **labs**
- Stores laboratory information
- Linked to a college
- Fields: name, code, department, building, floor, room, capacity

#### 3. **users**
- User accounts with role-based permissions
- Linked to a college and optionally a default lab
- Fields: email, password, name, role, college, lab, employee ID

#### 4. **assets**
- Equipment and resources
- Linked to a lab, creator, and updater
- Fields: name, category, manufacturer, model, serial number, status, dates, notes

#### 5. **audit_logs**
- Track system changes for accountability
- Records the borrowing lifecycle (requests, approvals, returns), user
  administration (create, role change, disable, password reset), and asset
  create/update/delete (field-level diffs, delete snapshots)
- Fields: user, action, entity, changes (JSON), timestamp

## 🔐 Authentication & Authorization

### Login Flow
1. User enters email and password (or is redirected to Keycloak when `AUTH_PROVIDER=keycloak`)
2. System validates credentials
3. JWT token created with user info, role and `sessionVersion`
4. Token stored in HTTP-only cookie
5. User redirected to dashboard

### Session Management
- **Token Type**: JWT (JSON Web Token)
- **Storage**: HTTP-only secure cookie
- **Duration**: 7 days
- **Validation**: Every request re-checks the database — the account must still exist,
  be active, and match its `sessionVersion`, so disabling an account or resetting its
  password revokes existing sessions immediately
- **Logout**: Clears session cookie (under SSO, also redirects to the Keycloak
  end-session URL)

### Permission Checks

#### Lab Creation/Management
```typescript
canCreateLabs(role):
  ✅ admin
  ✅ main_technician
  ❌ technician
```

#### Asset Deletion
```typescript
canDeleteAssets(role):
  ✅ admin
  ✅ main_technician
  ❌ technician
```

#### Asset Creation/Editing
```typescript
canCreateAssets(role):
  ✅ admin
  ✅ main_technician
  ✅ technician
```

#### Borrow Requests (create own, any technician+)
```typescript
canRequestAssets(role):
  ✅ admin
  ✅ main_technician
  ✅ technician
```

#### Approve/Reject Requests & Mark Loans Returned
```typescript
canApproveRequests(role):
  ✅ admin
  ✅ main_technician
  ❌ technician
```

#### User Management (admin only)
```typescript
canManageUsers(role):
  ✅ admin
  ❌ main_technician
  ❌ technician
```

## 🚀 Getting Started

### 1. Initial Setup

```bash
# Install dependencies
npm install

# Apply database migrations
npm run db:migrate

# Seed with sample data
npm run seed
```

### 2. Sample Credentials

After seeding, use these credentials to login:

**Admin Account:**
- Email: `admin@manipal.edu`
- Password: `password123`
- Access: Full system access

**Main Technician Account:**
- Email: `main.tech@manipal.edu`
- Password: `password123`
- Access: Can create labs and delete assets

**Technician Account:**
- Email: `tech1@manipal.edu` or `tech2@manipal.edu`
- Password: `password123`
- Access: View and edit assets only

### 3. First Login

1. Navigate to `/login`
2. Enter credentials from above
3. You'll be redirected to the dashboard
4. Your role badge appears in the top right

## 📱 User Interface by Role

### Admin View
```
┌──────────────────────────────────────────┐
│  🔬 Lab Asset Management System          │
│  MAHE Engineering Colleges               │
│                          [Administrator] │
│                          [Sign out →]    │
├──────────────────────────────────────────┤
│  📊 Statistics Cards                     │
├──────────────────────────────────────────┤
│  [🏢 Manage Labs] [+ Add Asset]         │
│                                          │
│  📋 Asset List (with Delete buttons)    │
└──────────────────────────────────────────┘
```

### Main Technician View
```
┌──────────────────────────────────────────┐
│  🔬 Lab Asset Management System          │
│  MAHE Engineering Colleges               │
│                     [Main Technician]    │
│                          [Sign out →]    │
├──────────────────────────────────────────┤
│  📊 Statistics Cards                     │
├──────────────────────────────────────────┤
│  [🏢 Manage Labs] [+ Add Asset]         │
│                                          │
│  📋 Asset List (with Delete buttons)    │
└──────────────────────────────────────────┘
```

### Technician View
```
┌──────────────────────────────────────────┐
│  🔬 Lab Asset Management System          │
│  MAHE Engineering Colleges               │
│                          [Technician]    │
│                          [Sign out →]    │
├──────────────────────────────────────────┤
│  📊 Statistics Cards                     │
├──────────────────────────────────────────┤
│  [+ Add Asset]                           │
│                                          │
│  📋 Asset List (Edit only, no Delete)   │
└──────────────────────────────────────────┘
```

## 🔧 Creating New Users

### Option 1: Direct Database Insert (Temporary)

```sql
INSERT INTO users (
  email, 
  password_hash, 
  name, 
  role, 
  college_id, 
  lab_id,
  employee_id,
  is_active
) VALUES (
  'newuser@manipal.edu',
  -- Use bcrypt to hash 'password123'
  '$2a$12$...',
  'New User Name',
  'technician',
  1, -- MIT college ID
  1, -- Lab ID (optional)
  'MIT-TECH-004',
  true
);
```

### Option 2: User Management UI & API (Implemented)

Admins manage users on the **Users** page (`/users`): create accounts, assign
role/college/lab, reset passwords, and enable/disable. The same operations are
available via `GET/POST /api/users`, `PUT /api/users/[id]`, and
`PUT /api/users/[id]/password`.

## 🏗️ Scaling to Multiple Colleges

### Adding a New College

```typescript
// Run migration or seed script
await db.insert(colleges).values({
  name: 'Manipal College of Pharmaceutical Sciences',
  code: 'MCOPS',
  address: 'Manipal, Karnataka 576104',
  contactEmail: 'mcops@manipal.edu',
  contactPhone: '+91-820-XXXXXXX',
  isActive: true,
});
```

### Adding Labs for New College

```typescript
const mcopsCollege = await db.select()
  .from(colleges)
  .where(eq(colleges.code, 'MCOPS'));

await db.insert(labs).values({
  name: 'Pharmaceutical Analysis Lab',
  code: 'MCOPS-LAB-001',
  department: 'Pharmaceutical Analysis',
  collegeId: mcopsCollege[0].id,
  capacity: 30,
});
```

### Creating Users for New College

Users are automatically scoped to their college. They'll only see:
- Assets in their college's labs
- Labs in their college
- Other users in their college (future)

## 🔒 Security Features

### 1. Authentication
- ✅ JWT-based session management
- ✅ Bcrypt password hashing (12 rounds)
- ✅ HTTP-only secure cookies
- ✅ Rate limiting on login (5 attempts/minute)

### 2. Authorization
- ✅ Role-based access control
- ✅ Route-level permission checks
- ✅ College-based data isolation
- ✅ Action-level permission validation

### 3. Data Protection
- ✅ SQL injection protection (Drizzle ORM)
- ✅ Input validation and sanitization
- ✅ XSS protection
- ✅ CSRF protection (cookies with SameSite)

### 4. Audit Trail (Implemented)
- ✅ Log create/update/delete operations (assets, borrowing lifecycle, user administration)
- ✅ Track who made changes and what changed (JSON diffs in `audit_logs`)
- 🔜 Record IP addresses (columns exist, not yet populated)
- 🔜 Compliance reporting UI

## 📈 Future Enhancements

### Phase 2 - User Management
- [x] Admin panel for user CRUD (shipped: `/users` page)
- [x] Password reset functionality (shipped: admin reset + self-service change)
- [ ] Email verification
- [ ] User invitation system

### Phase 3 - Advanced RBAC
- [ ] Custom roles with granular permissions
- [ ] Lab-specific technician assignments
- [x] Asset checkout system (shipped: borrowing/transfer lifecycle with approvals)
- [x] Approval workflows (shipped: pending-request approve/reject queue)

### Phase 4 - Multi-Tenancy
- [ ] College-level administrators
- [ ] Inter-college asset sharing
- [ ] Centralized reporting for MAHE
- [x] SSO integration (shipped: Keycloak OIDC via `AUTH_PROVIDER=keycloak`)

### Phase 5 - Advanced Features
- [ ] Asset maintenance scheduling
- [ ] Barcode/QR code scanning
- [ ] Mobile app
- [ ] Asset utilization analytics
- [ ] Automated compliance reporting

## 🧪 Testing Scenarios

### Test Case 1: Admin Full Access
1. Login as admin@manipal.edu
2. Create a new lab → ✅ Should succeed
3. Create an asset → ✅ Should succeed
4. Delete an asset → ✅ Should succeed

### Test Case 2: Main Technician Access
1. Login as main.tech@manipal.edu
2. Create a new lab → ✅ Should succeed
3. Delete an asset → ✅ Should succeed

### Test Case 3: Technician Limited Access
1. Login as tech1@manipal.edu
2. Try to create a lab → ❌ No "Manage Labs" button
3. Create an asset → ✅ Should succeed
4. Edit an asset → ✅ Should succeed
5. Try to delete an asset → ❌ No "Delete" button

### Test Case 4: Cross-College Isolation
1. Create user in MIT college
2. Create user in KMC college
3. Login as MIT user → Should only see MIT labs and assets
4. Login as KMC user → Should only see KMC labs and assets

## 🆘 Troubleshooting

### Problem: Can't login
- **Solution**: Verify user exists in database and is_active = true
- **Check**: User's college_id matches existing college

### Problem: Don't see "Manage Labs" button
- **Solution**: Only Admin and Main Technician can manage labs
- **Check**: User's role in database

### Problem: Can't delete assets
- **Solution**: Only Admin and Main Technician can delete
- **Check**: User's role, contact admin for role upgrade

### Problem: Don't see any assets
- **Solution**: Assets are filtered by college
- **Check**: User's college_id matches assets' lab's college_id

## 📞 Support

For issues or questions:
1. Check this documentation
2. Review SECURITY.md for security-related questions
3. Contact system administrator
4. Email: admin@manipal.edu

## 🎓 College Information

### Current MAHE Colleges in System

| Code | Name | Focus Area |
|------|------|-----------|
| MIT | Manipal Institute of Technology | Engineering |
| KMC | Kasturba Medical College | Medicine |
| MCODS | Manipal College of Dental Sciences | Dentistry |

### Lab Naming Convention

Format: `{COLLEGE_CODE}-LAB-{NUMBER}`

Examples:
- MIT-LAB-001
- MIT-LAB-002
- KMC-LAB-001
- MCODS-LAB-001

---

**© 2024 MAHE - Manipal Academy of Higher Education**
