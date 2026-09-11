# Lab Asset Management System for MAHE

A comprehensive fullstack web application for managing laboratory equipment and resources across multiple engineering colleges, built with Next.js 16 (App Router), PostgreSQL, and Drizzle ORM.

**Built for:** Manipal Academy of Higher Education (MAHE) Engineering Colleges

## 🚀 **Ready to Deploy?**

**Quick Deploy:** [DEPLOY_NOW.md](./DEPLOY_NOW.md) - Deploy in 5 minutes to Vercel!

**Choose Your Platform:**
- ⚡ **Vercel** - Free, 5 minutes
- 🚂 **Railway** - Database included, 3 minutes  
- 🎨 **Render** - Free tier available, 10 minutes

[📖 Full Deployment Guide](./DEPLOYMENT.md) | [⚡ Quick Deploy Guide](./QUICK_DEPLOY.md)

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

### 🔬 Asset Management
- ✅ Create, read, update, and delete lab assets
- 🔍 Search and filter assets by name, serial number, manufacturer, or location
- 📊 Real-time statistics dashboard showing total assets, available, in use, and under maintenance
- 🏷️ Categorize assets (microscopes, centrifuges, incubators, freezers, etc.)
- 🏭 Lab-specific asset tracking

### Asset Tracking
- **Status Management**: Track asset status (Available, In Use, Maintenance, Retired)
- **Location Tracking**: Monitor where each asset is located within the lab
- **Serial Numbers**: Track unique identifiers for each piece of equipment
- **Warranty Management**: Record purchase dates and warranty expiry dates

### User Interface
- 📱 Responsive design that works on desktop, tablet, and mobile
- 🎨 Clean, modern UI with Tailwind CSS
- 🔢 Interactive data tables with inline editing
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
- `location`: Lab location
- `status`: Current status (enum: available, in_use, maintenance, retired)
- `purchaseDate`: Date of purchase
- `warrantyExpiry`: Warranty expiration date
- `notes`: Additional notes
- `createdAt`: Record creation timestamp
- `updatedAt`: Last update timestamp

## API Endpoints

### GET /api/assets
Fetch all assets with optional filtering:
- Query params: `search`, `status`, `category`

### POST /api/assets
Create a new asset

### GET /api/assets/[id]
Fetch a specific asset by ID

### PUT /api/assets/[id]
Update an existing asset

### DELETE /api/assets/[id]
Delete an asset

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

# Push schema
npx drizzle-kit push

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

# Push database schema
npx drizzle-kit push
```

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
- ⚠️ **Authentication Ready** - API key auth available (disabled by default)

### ⚠️ IMPORTANT: Before Production

**This application is NOT production-ready by default.** See [SECURITY.md](./SECURITY.md) for:
- Complete security vulnerability assessment
- Production hardening checklist
- Required configuration changes
- Authentication setup guide

**See [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md) for deployment guide.**

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [GETTING_STARTED.md](./GETTING_STARTED.md) | **START HERE** - Complete setup guide for new users |
| [RBAC_GUIDE.md](./RBAC_GUIDE.md) | Complete role-based access control documentation |
| [LAB_HIERARCHY_GUIDE.md](./LAB_HIERARCHY_GUIDE.md) | **NEW** - Lab dashboard & hierarchy system guide |
| [SECURITY.md](./SECURITY.md) | Security features and vulnerability assessment |
| [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md) | Production deployment guide |
| [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) | Upgrade from basic version to RBAC version |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System architecture and design |
| [SECURITY_SUMMARY.md](./SECURITY_SUMMARY.md) | Quick security reference |

## 🎓 MAHE Colleges Supported

- **MIT** - Manipal Institute of Technology (Engineering)
- **KMC** - Kasturba Medical College (Medicine)
- **MCODS** - Manipal College of Dental Sciences (Dentistry)
- **Scalable to all MAHE institutions**

## 🤝 Contributing

This project is designed for MAHE colleges. To add your college:

1. Follow [GETTING_STARTED.md](./GETTING_STARTED.md)
2. Add your college via seed script or SQL
3. Create labs for your departments
4. Import your equipment data

## 📄 License

MIT

---

**Built with ❤️ for MAHE Engineering Colleges**

For support: Contact your system administrator or IT department
