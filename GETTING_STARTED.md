# Getting Started with Lab Asset Management System

## 🎓 Welcome to MAHE Lab Asset Management!

This system helps you track and manage laboratory equipment across engineering colleges under Manipal Academy of Higher Education (MAHE).

## 🚀 Quick Installation

### Prerequisites

- Node.js 18+ installed
- PostgreSQL 14+ installed
- Git

### 1. Clone & Install

```bash
git clone <repository-url>
cd lab-asset-management
npm install
```

### 2. Database Setup

```bash
# Create database
createdb app_db

# Create .env file
cat > .env << EOF
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/app_db
JWT_SECRET=$(openssl rand -base64 32)
NODE_ENV=development
EOF
```

### 3. Initialize Database

```bash
# Push database schema
npx drizzle-kit push

# Seed with sample data
npm run seed
```

This creates:
- 3 colleges (MIT, KMC, MCODS)
- 4 labs in MIT
- 4 users (1 admin, 1 main technician, 2 technicians)

### 4. Start Application

```bash
npm run dev
```

Open http://localhost:3000/login

## 🔑 Login for First Time

### Admin Access
```
Email: admin@manipal.edu
Password: password123
```

**Can do:** Everything - create labs, manage assets, delete items

### Main Technician Access
```
Email: main.tech@manipal.edu
Password: password123
```

**Can do:** Create labs, manage assets, delete items

### Technician Access
```
Email: tech1@manipal.edu
Password: password123
```

**Can do:** View and manage assets (cannot delete or create labs)

## 📱 First Steps After Login

### As Admin (admin@manipal.edu)

1. **Explore the Dashboard**
   - See statistics cards showing asset counts
   - Notice "Manage Labs" and "Add Asset" buttons
   - Your role badge shows "Administrator"

2. **Check Existing Labs**
   - Click "Manage Labs"
   - See 4 pre-seeded labs for MIT
   - Try creating a new lab for your department

3. **Add Your First Asset**
   - Click "+ Add Asset"
   - Fill in details (name, category, lab, location)
   - Submit to create

4. **Manage Assets**
   - Edit any asset by clicking "Edit"
   - Delete assets using "Delete" button
   - Search and filter to find specific items

### As Main Technician (main.tech@manipal.edu)

1. **View Your Dashboard**
   - See stats for assets in your college
   - Notice you have both buttons: "Manage Labs" and "Add Asset"

2. **Create a Lab**
   - Click "Manage Labs"
   - Add a new lab for your department
   - Fill in building, floor, room details

3. **Add Assets to Your Lab**
   - Click "+ Add Asset"
   - Select your lab from dropdown
   - Add equipment details

### As Technician (tech1@manipal.edu)

1. **View Assets**
   - See all assets in your college
   - Notice "Manage Labs" button is missing
   - You can only add/edit assets

2. **Add New Equipment**
   - Click "+ Add Asset"
   - Select lab (likely your assigned lab)
   - Enter asset details

3. **Update Asset Status**
   - Click "Edit" on any asset
   - Change status (Available, In Use, Maintenance, Retired)
   - Save changes

## 🏗️ Setting Up for Your College

### Step 1: Add Your College

If your college isn't in the seed data, add it:

```bash
# Connect to database
psql postgresql://postgres:postgres@localhost:5432/app_db

# Add college
INSERT INTO colleges (name, code, address, contact_email, contact_phone, is_active)
VALUES (
  'Your College Name',
  'YCODE',
  'College Address',
  'contact@yourcollege.edu',
  '+91-XXX-XXXXXXX',
  true
);
```

### Step 2: Create Labs for Your College

Using the admin account:
1. Login
2. Click "Manage Labs"
3. Click "+ Add New Lab"
4. Fill in:
   - Lab Name: "Advanced Materials Lab"
   - Lab Code: "YCODE-LAB-001"
   - Department: "Mechanical Engineering"
   - Building, Floor, Room Number
   - Capacity

### Step 3: Create User Accounts

```sql
-- Connect to PostgreSQL
psql postgresql://postgres:postgres@localhost:5432/app_db

-- Create admin for your college
INSERT INTO users (
  email, password_hash, name, role, college_id, 
  employee_id, is_active
) VALUES (
  'your.admin@college.edu',
  -- Hash 'password123' using bcrypt
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5QE8RWZ.Ym1Km',
  'Your Name',
  'admin',
  1, -- Your college ID
  'YCODE-ADMIN-001',
  true
);
```

**Generate new password hash:**

```bash
node -e "console.log(require('bcryptjs').hashSync('your-password', 12))"
```

### Step 4: Import Existing Assets

If you have existing equipment data:

1. **Prepare CSV/Excel file** with columns:
   - name
   - category
   - manufacturer
   - model
   - serial_number
   - location
   - status

2. **Convert to SQL** or use admin interface to add manually

3. **Bulk import** (advanced):

```javascript
// bulk-import.js
const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  connectionString: 'postgresql://postgres:postgres@localhost:5432/app_db'
});

async function importAssets(labId, userId) {
  const data = JSON.parse(fs.readFileSync('assets.json'));
  
  for (const item of data) {
    await pool.query(`
      INSERT INTO assets (
        name, category, manufacturer, model, serial_number,
        lab_id, location, status, created_by_id, updated_by_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
      item.name,
      item.category || 'other',
      item.manufacturer,
      item.model,
      item.serial_number,
      labId,
      item.location,
      item.status || 'available',
      userId,
      userId
    ]);
  }
  console.log(`Imported ${data.length} assets`);
  await pool.end();
}

importAssets(1, 1); // Lab ID 1, User ID 1
```

## 📚 Learning the System

### Understanding Roles

| You Are | You Can | You Cannot |
|---------|---------|------------|
| **Admin** | Everything | Nothing restricted |
| **Main Technician** | Create labs, All asset operations | Manage users (future) |
| **Technician** | Add/edit assets | Delete assets, Create labs |

### Understanding Labs

- **Lab** = Physical laboratory space
- Each lab has:
  - Unique code (e.g., "MIT-LAB-001")
  - Department assignment
  - Location (building, floor, room)
  - Capacity
- Assets are assigned to labs
- You can have multiple labs

### Understanding Assets

- **Asset** = Any equipment or resource
- Each asset has:
  - Name and category
  - Serial number (optional)
  - Location within lab
  - Status (Available, In Use, Maintenance, Retired)
  - Purchase and warranty dates
  - Notes

## 🔒 Security Best Practices

### 1. Change Default Passwords

**IMPORTANT:** Change the default "password123" immediately!

```sql
-- Update user password
UPDATE users 
SET password_hash = '$2a$12$NEW_HASH_HERE'
WHERE email = 'admin@manipal.edu';
```

### 2. Create Strong Passwords

```bash
# Generate strong password hash
node -e "console.log(require('bcryptjs').hashSync('Your-Strong-P@ssw0rd', 12))"
```

### 3. Secure Your Environment

```bash
# Production .env
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require
JWT_SECRET=very-long-random-string-min-32-characters
NODE_ENV=production
```

### 4. Regular Backups

```bash
# Daily backup script
#!/bin/bash
pg_dump -U postgres -d app_db > backup_$(date +%Y%m%d).sql

# Keep last 7 days
find /backups -name "backup_*.sql" -mtime +7 -delete
```

## 🆘 Common Issues & Solutions

### Problem: "Cannot find module"

```bash
# Solution: Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Problem: "DATABASE_URL is required"

```bash
# Solution: Check .env file exists
cat .env

# If missing, create it:
echo "DATABASE_URL=postgresql://postgres:postgres@localhost:5432/app_db" > .env
echo "JWT_SECRET=$(openssl rand -base64 32)" >> .env
```

### Problem: "Table does not exist"

```bash
# Solution: Push schema
npx drizzle-kit push
npm run seed
```

### Problem: Can't login

```bash
# Check users exist
psql -U postgres -d app_db -c "SELECT email, role FROM users;"

# Re-seed if empty
npm run seed
```

### Problem: "Access Denied" or "Forbidden"

- **Cause:** Your role doesn't have permission
- **Solution:** Check your role badge
- **Fix:** Contact admin to upgrade your role if needed

## 📖 Next Steps

Now that you're set up:

1. **Read Full Documentation**
   - [RBAC_GUIDE.md](./RBAC_GUIDE.md) - Complete role and permission guide
   - [SECURITY.md](./SECURITY.md) - Security features and best practices
   - [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md) - Deploy to production

2. **Customize for Your Needs**
   - Add your college and labs
   - Create user accounts for your team
   - Import existing asset data

3. **Train Your Team**
   - Share login credentials
   - Explain role differences
   - Demonstrate key features

4. **Plan for Production**
   - Review security requirements
   - Set up backup system
   - Configure monitoring

## 🎯 Daily Usage

### Morning Routine (Technician)
1. Login
2. Check asset status
3. Update any changes (In Use, Maintenance)
4. Add new equipment if received

### Weekly Tasks (Main Technician)
1. Review asset utilization
2. Schedule maintenance for flagged items
3. Update warranty expirations
4. Generate reports (future feature)

### Monthly Tasks (Admin)
1. Audit asset inventory
2. Review user access
3. Backup database
4. Update system

## 📞 Getting Help

1. **Check Documentation**
   - README.md - Overview
   - RBAC_GUIDE.md - Roles and permissions
   - This file - Getting started

2. **Database Issues**
   - Check PostgreSQL is running: `pg_isready`
   - Review connection string in .env
   - Check logs: `tail -f /var/log/postgresql/*.log`

3. **Application Issues**
   - Check Node.js version: `node --version` (need 18+)
   - Review browser console for errors
   - Check terminal for server errors

4. **Contact Support**
   - System Administrator
   - IT Department
   - Email: admin@manipal.edu

## 🎉 You're Ready!

You now have:
- ✅ Working installation
- ✅ Sample data to explore
- ✅ Understanding of roles
- ✅ Knowledge of key features

**Happy asset managing! 🔬**

---

© 2024 MAHE - Manipal Academy of Higher Education
