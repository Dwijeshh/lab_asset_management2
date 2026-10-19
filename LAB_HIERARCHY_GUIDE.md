# Lab Hierarchy & Dashboard Guide

## 🏗️ Lab Structure Overview

The system now supports a proper hierarchical structure for managing labs across MAHE colleges:

```
College (e.g., MIT)
├── Department Lab 1 (e.g., CSE Lab)
│   ├── Main Technician (1 person) - Lab Head
│   └── Technicians (Multiple) - Under Main Tech
├── Department Lab 2 (e.g., ECE Lab)
│   ├── Main Technician (1 person)
│   └── Technicians (Multiple)
└── Department Lab 3 (e.g., Civil Lab)
    ├── Main Technician (1 person)
    └── Technicians (Multiple)
```

## 👥 Role Hierarchy

### Administrator
- **Scope**: Entire college
- **Can access**: All labs in the college
- **Permissions**: Full control over all labs and assets

### Main Technician
- **Scope**: Assigned to ONE specific lab/department
- **Can access**: Their assigned lab + view all labs
- **Permissions**: 
  - Create labs
  - Full control over assets in their lab
  - Can delete assets
  - Manages technicians under them

### Technician
- **Scope**: Works under a Main Technician in a specific lab
- **Can access**: Their assigned lab
- **Permissions**:
  - View assets
  - Create and edit assets
  - Cannot delete assets
  - Cannot create labs

## 🏢 Lab Dashboard Features

### Accessing Lab Dashboards

1. **From Main Dashboard:**
   - Click "🏢 View Labs" button (Admin/Main Tech only)

2. **Labs Listing Page** (`/labs`):
   - Shows all labs in your college
   - Grid view with lab cards
   - Click any lab card to view its dashboard
   - "Create New Lab" button (Admin/Main Tech only)

3. **Individual Lab Dashboard** (`/labs/[id]`):
   - Complete lab overview
   - Team members assigned to lab
   - Lab-specific asset statistics
   - All assets in that lab
   - Add assets directly to the lab

## 📊 Lab Dashboard Components

### 1. Lab Information Card
```
🔬 Advanced Materials Lab
Lab Code: MIT-LAB-001

Department: Mechanical Engineering
Location: Academic Block A, 2nd Floor, Room 201
Capacity: 30 students
Status: Active
```

### 2. Lab Team Section
Shows the hierarchical team:

**Main Technician** (Blue highlight)
- Name, email, employee ID
- Badge: "Main Technician"

**Technicians** (Under the Main Tech)
- List of all technicians
- Each shows: Name, email, employee ID
- Badge: "Technician"

### 3. Asset Statistics (Lab-specific)
- Total Assets in this lab
- Available assets
- Assets in use
- Assets under maintenance

### 4. Lab Assets List
- Filtered to show only assets in this lab
- Full asset management (add, edit, delete*)
- *Delete only for Admin/Main Tech

## 🎯 Typical Use Cases

### Scenario 1: CSE Department Lab

**Setup:**
```
CSE Lab (MIT-LAB-003)
├── Main Technician: Rajesh Kumar (main.tech.cse@manipal.edu)
│   └── Manages: Computers, Servers, Network Equipment
└── Technicians:
    ├── Priya Sharma (tech.cse.1@manipal.edu)
    ├── Amit Patel (tech.cse.2@manipal.edu)
    └── Sneha Rao (tech.cse.3@manipal.edu)
```

**Daily Workflow:**

1. **Rajesh (Main Tech)** logs in:
   - Views CSE Lab dashboard
   - Checks asset status
   - Assigns tasks to technicians
   - Approves new equipment additions

2. **Priya (Technician)** logs in:
   - Sees CSE Lab assets
   - Updates computer status (Available → In Use)
   - Adds new keyboard received
   - Reports broken monitor (status → Maintenance)

### Scenario 2: Multiple Labs Management

**Admin View:**
```
Dr. Admin Kumar (Admin)
├── Can view ALL labs:
│   ├── CSE Lab
│   ├── ECE Lab
│   ├── Mechanical Lab
│   └── Civil Lab
└── Can create new labs
└── Can delete assets from any lab
```

**Workflow:**
1. Click "View Labs" from main dashboard
2. See grid of all 4 labs
3. Click "CSE Lab" → View CSE-specific dashboard
4. Click "ECE Lab" → View ECE-specific dashboard
5. Compare resource allocation across labs

## 🔧 Lab Creation Workflow

### For Admin or Main Technician:

1. **Navigate to Labs:**
   - Click "View Labs" from main dashboard
   - OR click "Create Lab" directly

2. **Fill Lab Details:**
   ```
   Lab Name: Electronics & Communication Lab
   Lab Code: MIT-LAB-002
   Department: Electronics & Communication
   Building: Academic Block B
   Floor: 3rd Floor
   Room Number: 302
   Capacity: 40 students
   ```

3. **Lab Created:**
   - Appears in labs grid
   - Can now assign users to this lab
   - Can add assets to this lab

## 👤 Assigning Users to Labs

### Method 1: Database (Current)

```sql
-- Assign Main Technician to ECE Lab
UPDATE users 
SET lab_id = 2, role = 'main_technician'
WHERE email = 'ece.maintech@manipal.edu';

-- Assign Technicians to ECE Lab
UPDATE users 
SET lab_id = 2, role = 'technician'
WHERE email IN (
  'ece.tech1@manipal.edu',
  'ece.tech2@manipal.edu'
);
```

### Method 2: User Management UI (Implemented)
- Admins assign users to labs on the **Users** page (`/users`) — create accounts,
  set the default lab, or move users between labs
- Changes take effect immediately (sessions are re-validated against the
  database on every request)

## 📈 Asset Management Per Lab

### Adding Asset to Specific Lab:

1. **From Lab Dashboard:**
   - Go to `/labs/2` (ECE Lab)
   - Click "+ Add Asset to Lab"
   - Lab is pre-selected
   - Fill asset details
   - Submit

2. **From Main Dashboard:**
   - Click "+ Add Asset"
   - Select lab from dropdown
   - Fill asset details
   - Submit

### Viewing Lab-Specific Assets:

**Option A: Lab Dashboard**
- Shows ONLY assets in that lab
- Filtered automatically
- Lab-specific statistics

**Option B: Main Dashboard**
- Shows ALL assets across college
- Can filter by search/category/status

## 🔍 Navigation Flow

```
Main Dashboard (/)
├── View Labs Button → Labs Listing (/labs)
│   └── Click Lab Card → Lab Dashboard (/labs/[id])
│       ├── View Team
│       ├── View Lab Stats
│       ├── Manage Assets
│       └── Back to Labs → Back to Main
│
├── Create Lab Button → Lab Form Modal
│   └── Create → Refresh → New Lab Appears
│
└── Add Asset Button → Asset Form Modal
    └── Select Lab → Create Asset
```

## 📱 User Experience by Role

### Admin Login Flow:
```
1. Login → Main Dashboard
2. See all colleges' assets
3. Click "View Labs" → See all labs grid
4. Click "CSE Lab" → Lab dashboard with team & assets
5. Click "ECE Lab" → Different lab, different team
6. Can create labs, delete assets anywhere
```

### Main Technician Login Flow:
```
1. Login → Main Dashboard
2. See college assets (filtered by college)
3. Click "View Labs" → See all labs in college
4. Click "My Lab" → My lab dashboard
5. See my team members
6. Manage my lab's assets
7. Can create new labs if needed
```

### Technician Login Flow:
```
1. Login → Main Dashboard
2. See college assets
3. No "View Labs" button (technicians focus on work)
4. Add/edit assets (assigned to their lab by default)
5. Cannot delete assets
```

## 🎨 Visual Indicators

### Lab Cards:
- **Active**: Green badge, full functionality
- **Inactive**: Gray badge, read-only

### User Roles in Lab Team:
- **Main Technician**: Blue background, highlighted
- **Technician**: Gray background, listed under Main Tech

### Asset Statistics:
- **Total Assets**: Blue
- **Available**: Green
- **In Use**: Purple
- **Maintenance**: Yellow

## 🚀 Best Practices

### 1. Lab Organization
- One Main Technician per lab/department
- Multiple Technicians under each Main Tech
- Clear lab codes (MIT-LAB-001, MIT-LAB-002, etc.)

### 2. Asset Assignment
- Assign assets to specific labs
- Keep location specific within lab
- Update status regularly

### 3. Team Structure
- Main Tech oversees their lab
- Technicians report to Main Tech
- Admin oversees all labs

### 4. Workflow
- Use lab dashboards for focused work
- Use main dashboard for overview
- Regular team updates

## 📞 Common Questions

**Q: Can a technician see other labs?**
A: Technicians can see assets from their college but should primarily work with their assigned lab.

**Q: Can there be multiple Main Technicians in one lab?**
A: No. Each lab should have ONE Main Technician. If you need more senior staff, consider creating separate labs or sub-labs.

**Q: How do I switch between labs?**
A: Use the "View Labs" button to see all labs, then click on any lab to view its dashboard.

**Q: Can assets be moved between labs?**
A: Yes, edit the asset and change the lab assignment.

**Q: Can a Main Technician manage multiple labs?**
A: While technically they can access all labs, they should be assigned to ONE primary lab. Admins manage across all labs.

---

**Your lab hierarchy is now set up! 🎉**

**Next Steps:**
1. Login and explore the "View Labs" feature
2. Create labs for each department
3. Assign users to their respective labs
4. Start managing assets per lab
