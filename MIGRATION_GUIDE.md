# Migration Guide: Adding RBAC to Existing Installation

This guide helps you migrate from the basic Lab Asset Management System to the new RBAC-enabled version.

## ⚠️ Important Notes

- **This migration requires database schema changes**
- **Existing asset data can be preserved with manual steps**
- **Downtime will be required during migration**
- **Backup your database before starting**

## 🔄 Migration Steps

### Step 1: Backup Current Database

```bash
# Backup entire database
pg_dump -U postgres -d app_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Or backup just the assets table
pg_dump -U postgres -d app_db -t assets > assets_backup_$(date +%Y%m%d_%H%M%S).sql
```

### Step 2: Pull Latest Code

```bash
git pull origin main
npm install
```

### Step 3: Update Environment Variables

Add JWT secret to `.env`:

```bash
# Add this line to your .env file
JWT_SECRET=$(openssl rand -base64 32)
```

Your `.env` should now include:
```bash
DATABASE_URL=postgresql://user:password@localhost:5432/app_db
JWT_SECRET=your-generated-secret-here
NODE_ENV=development
```

### Step 4: Schema Migration

#### Option A: Fresh Start (Recommended if no critical data)

```bash
# Drop existing tables
psql -U postgres -d app_db -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# Push new schema
npx drizzle-kit push

# Seed with sample data
npm run seed
```

#### Option B: Preserve Existing Assets (Complex)

1. **Export existing assets to JSON:**

```bash
# Create export script
cat > export_assets.js << 'EOF'
const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function exportAssets() {
  const { rows } = await pool.query('SELECT * FROM assets');
  fs.writeFileSync('assets_export.json', JSON.stringify(rows, null, 2));
  console.log(`Exported ${rows.length} assets`);
  await pool.end();
}

exportAssets();
EOF

# Run export
node export_assets.js
```

2. **Apply new schema:**

```bash
# Drop old schema
psql -U postgres -d app_db -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# Push new schema
npx drizzle-kit push

# Seed initial data (colleges, labs, users)
npm run seed
```

3. **Import assets with new required fields:**

```bash
# Create import script
cat > import_assets.js << 'EOF'
const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function importAssets() {
  const assets = JSON.parse(fs.readFileSync('assets_export.json'));
  
  // Get first lab ID to assign assets to
  const { rows: labs } = await pool.query('SELECT id FROM labs LIMIT 1');
  const defaultLabId = labs[0].id;
  
  // Get admin user ID
  const { rows: users } = await pool.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
  const adminId = users[0].id;

  for (const asset of assets) {
    await pool.query(`
      INSERT INTO assets (
        name, category, manufacturer, model, serial_number,
        lab_id, location, status, purchase_date, warranty_expiry,
        notes, created_by_id, updated_by_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `, [
      asset.name,
      asset.category,
      asset.manufacturer,
      asset.model,
      asset.serial_number || asset.serialnumber,
      defaultLabId, // Assign to default lab
      asset.location,
      asset.status,
      asset.purchase_date || asset.purchasedate,
      asset.warranty_expiry || asset.warrantyexpiry,
      asset.notes,
      adminId,
      adminId
    ]);
  }
  
  console.log(`Imported ${assets.length} assets`);
  await pool.end();
}

importAssets();
EOF

# Run import
node import_assets.js
```

### Step 5: Verify Migration

1. **Check database tables:**

```bash
psql -U postgres -d app_db -c "\dt"
```

You should see:
- colleges
- labs
- users
- assets
- audit_logs

2. **Verify data:**

```bash
# Count records
psql -U postgres -d app_db << EOF
SELECT 'Colleges:', COUNT(*) FROM colleges;
SELECT 'Labs:', COUNT(*) FROM labs;
SELECT 'Users:', COUNT(*) FROM users;
SELECT 'Assets:', COUNT(*) FROM assets;
EOF
```

3. **Test login:**

```bash
npm run dev
# Navigate to http://localhost:3000/login
# Try logging in with admin@manipal.edu / password123
```

### Step 6: Create Additional Users

Using the admin account or database, create users for your team:

```sql
-- Main Technician
INSERT INTO users (
  email, password_hash, name, role, college_id, lab_id, 
  employee_id, is_active
) VALUES (
  'tech.head@manipal.edu',
  '$2a$12$...', -- Generate with bcrypt
  'Technical Head Name',
  'main_technician',
  1, -- Your college ID
  1, -- Their assigned lab
  'MIT-TECH-HEAD-001',
  true
);

-- Regular Technician
INSERT INTO users (
  email, password_hash, name, role, college_id, lab_id,
  employee_id, is_active
) VALUES (
  'lab.tech@manipal.edu',
  '$2a$12$...', -- Generate with bcrypt
  'Lab Technician Name',
  'technician',
  1,
  1,
  'MIT-TECH-005',
  true
);
```

**Generate password hash:**

```javascript
const bcrypt = require('bcryptjs');
const hash = bcrypt.hashSync('your-password', 12);
console.log(hash);
```

## 🔧 Post-Migration Configuration

### 1. Update Lab Assignments

After migration, assign assets to proper labs:

```sql
-- List current assets and their labs
SELECT a.id, a.name, l.name as lab_name 
FROM assets a 
JOIN labs l ON a.lab_id = l.id;

-- Update asset lab assignment
UPDATE assets 
SET lab_id = [new_lab_id]
WHERE id = [asset_id];
```

### 2. Assign Users to Labs

```sql
-- Update user's default lab
UPDATE users 
SET lab_id = [lab_id]
WHERE email = 'user@manipal.edu';
```

### 3. Configure College Information

```sql
-- Update college details
UPDATE colleges 
SET 
  address = 'Updated Address',
  contact_email = 'new.contact@manipal.edu',
  contact_phone = '+91-XXX-XXXXXXX'
WHERE code = 'MIT';
```

## 🎓 Customizing for Your College

### Adding Your College

If your college isn't in the seed data:

```sql
INSERT INTO colleges (name, code, address, contact_email, contact_phone, is_active)
VALUES (
  'Your College Name',
  'CODE', -- 3-5 letter code
  'Full Address',
  'contact@college.edu',
  '+91-XXX-XXXXXXX',
  true
);
```

### Creating Your Labs

```sql
INSERT INTO labs (
  name, code, department, building, floor, room_number,
  college_id, capacity, is_active
) VALUES (
  'Your Lab Name',
  'CODE-LAB-001',
  'Department Name',
  'Building Name',
  '2nd Floor',
  '201',
  [your_college_id],
  30,
  true
);
```

## 🐛 Troubleshooting

### Problem: Migration script fails

**Solution:**
1. Check PostgreSQL connection
2. Verify DATABASE_URL in .env
3. Ensure you have database permissions
4. Review error messages for specific issues

### Problem: Can't login after migration

**Possible causes:**
1. Users table not seeded
2. JWT_SECRET not set
3. Cookies not being set (check HTTPS in production)

**Solution:**
```bash
# Verify users exist
psql -U postgres -d app_db -c "SELECT email, role FROM users;"

# Re-run seed if needed
npm run seed
```

### Problem: Assets not visible

**Cause:** College isolation - users only see assets in their college's labs

**Solution:**
1. Verify user's college_id matches asset's lab's college_id
2. Check asset lab assignments

```sql
-- Check user's college
SELECT u.email, u.college_id, c.name 
FROM users u 
JOIN colleges c ON u.college_id = c.id
WHERE u.email = 'your@email.edu';

-- Check asset's college through lab
SELECT a.name, l.name as lab, c.name as college
FROM assets a
JOIN labs l ON a.lab_id = l.id
JOIN colleges c ON l.college_id = c.id;
```

### Problem: Missing role permissions

**Cause:** User has 'technician' role but needs higher privileges

**Solution:**
```sql
-- Upgrade user to main_technician
UPDATE users 
SET role = 'main_technician'
WHERE email = 'user@manipal.edu';

-- Or make admin
UPDATE users 
SET role = 'admin'
WHERE email = 'user@manipal.edu';
```

## 📊 Verification Checklist

After migration, verify:

- [ ] Can login with seed credentials
- [ ] See correct role badge (Admin/Main Technician/Technician)
- [ ] Stats cards show data
- [ ] Can view assets
- [ ] Can create new asset
- [ ] Can edit existing asset
- [ ] Admin can create labs
- [ ] Admin can delete assets
- [ ] Technician cannot delete assets
- [ ] Technician cannot create labs
- [ ] All assets assigned to valid labs
- [ ] Users assigned to correct colleges

## 🔄 Rollback Plan

If migration fails:

### Option 1: Restore from backup

```bash
# Drop current database
dropdb app_db

# Create fresh database
createdb app_db

# Restore from backup
psql -U postgres -d app_db < backup_YYYYMMDD_HHMMSS.sql

# Checkout previous code version
git checkout [previous-commit]

# Reinstall old dependencies
npm install

# Start old version
npm run dev
```

### Option 2: Manual rollback

```bash
# Drop new schema
psql -U postgres -d app_db -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# Restore old schema
psql -U postgres -d app_db < backup_YYYYMMDD_HHMMSS.sql
```

## 📞 Support

For migration assistance:
1. Review error logs carefully
2. Check PostgreSQL logs: `tail -f /var/log/postgresql/postgresql-*.log`
3. Consult RBAC_GUIDE.md for role setup
4. Contact system administrator

## 🎯 Next Steps After Migration

1. **Change default passwords** for all seed users
2. **Create real user accounts** for your team
3. **Organize labs** according to your college structure
4. **Import or create** your actual assets
5. **Train users** on the new role-based system
6. **Review** SECURITY.md for production deployment

---

**Migration completed? See RBAC_GUIDE.md for full system usage!**
