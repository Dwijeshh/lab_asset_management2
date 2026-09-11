# Deployment Guide - Lab Asset Management System

## 🚀 Quick Deploy Options

Choose your preferred platform:

### Option 1: Vercel (Recommended - Easiest)
**Best for:** Quick deployment, automatic HTTPS, free tier available

### Option 2: Railway
**Best for:** Full-stack with database included, easy setup

### Option 3: Render
**Best for:** Free tier with PostgreSQL included

### Option 4: DigitalOcean App Platform
**Best for:** Scalable production deployments

---

## 🌟 Option 1: Deploy to Vercel (Recommended)

### Prerequisites
- GitHub account
- Vercel account (free) - https://vercel.com

### Step 1: Push Code to GitHub

```bash
# Initialize git (if not already done)
git init
git add .
git commit -m "Initial commit - Lab Asset Management System"

# Create a new repository on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/lab-asset-management.git
git branch -M main
git push -u origin main
```

### Step 2: Set Up PostgreSQL Database

**Option A: Vercel Postgres (Easiest)**
1. Go to https://vercel.com/dashboard
2. Click "Storage" → "Create Database"
3. Select "Postgres"
4. Copy the connection string

**Option B: Supabase (Free tier)**
1. Go to https://supabase.com
2. Create new project
3. Go to Settings → Database
4. Copy connection string (use "Connection Pooling" URL)

**Option C: Neon (Serverless Postgres)**
1. Go to https://neon.tech
2. Create free project
3. Copy connection string

### Step 3: Deploy to Vercel

1. Go to https://vercel.com/new
2. Import your GitHub repository
3. Configure project:
   - **Framework Preset**: Next.js
   - **Root Directory**: ./
   - **Build Command**: `npm run build`
   - **Output Directory**: .next

4. **Add Environment Variables:**
   ```
   DATABASE_URL=your_postgres_connection_string
   JWT_SECRET=your_generated_secret_here
   NODE_ENV=production
   ```

5. Click **Deploy**

### Step 4: Push Database Schema

After deployment:
```bash
# Install Vercel CLI
npm i -g vercel

# Link to your project
vercel link

# Push schema to production database
DATABASE_URL="your_production_db_url" npx drizzle-kit push

# Seed initial data
DATABASE_URL="your_production_db_url" npm run seed
```

### Step 5: Access Your App
- Your app will be at: `https://your-project.vercel.app`
- Go to `/login` and use seeded credentials

---

## 🚂 Option 2: Deploy to Railway

### Step 1: Create Railway Account
Go to https://railway.app and sign up with GitHub

### Step 2: Deploy

1. Click **"New Project"**
2. Select **"Deploy from GitHub repo"**
3. Select your repository
4. Railway will auto-detect Next.js

### Step 3: Add PostgreSQL

1. In your project, click **"New"** → **"Database"** → **"PostgreSQL"**
2. Railway automatically sets `DATABASE_URL` environment variable

### Step 4: Add Environment Variables

Go to your service → Variables:
```
JWT_SECRET=your_generated_secret_here
NODE_ENV=production
```

### Step 5: Deploy & Seed

Railway will auto-deploy. Once deployed:

1. Go to PostgreSQL service → Connect
2. Copy connection string
3. Run locally:
```bash
DATABASE_URL="railway_postgres_url" npx drizzle-kit push
DATABASE_URL="railway_postgres_url" npm run seed
```

### Step 6: Access
Your app will be at: `https://your-app.up.railway.app`

---

## 🎨 Option 3: Deploy to Render

### Step 1: Create Render Account
Go to https://render.com

### Step 2: Create PostgreSQL Database

1. Dashboard → **"New"** → **"PostgreSQL"**
2. Name: `lab-asset-db`
3. Copy **Internal Database URL**

### Step 3: Create Web Service

1. Dashboard → **"New"** → **"Web Service"**
2. Connect your GitHub repository
3. Configure:
   - **Name**: lab-asset-management
   - **Environment**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`

### Step 4: Environment Variables

Add in Render dashboard:
```
DATABASE_URL=your_internal_postgres_url
JWT_SECRET=your_generated_secret
NODE_ENV=production
```

### Step 5: Deploy & Seed

After deployment:
```bash
DATABASE_URL="render_postgres_url" npx drizzle-kit push
DATABASE_URL="render_postgres_url" npm run seed
```

### Step 6: Access
Your app: `https://lab-asset-management.onrender.com`

---

## 💧 Option 4: DigitalOcean App Platform

### Step 1: Create DigitalOcean Account
Go to https://cloud.digitalocean.com

### Step 2: Create Managed Database

1. Create → Databases → PostgreSQL
2. Choose plan (starts at $15/month)
3. Copy connection string

### Step 3: Create App

1. Apps → Create App
2. Connect GitHub repository
3. Configure:
   - **Type**: Web Service
   - **Build Command**: `npm run build`
   - **Run Command**: `npm start`

### Step 4: Environment Variables

```
DATABASE_URL=your_do_postgres_url
JWT_SECRET=your_generated_secret
NODE_ENV=production
```

### Step 5: Deploy & Seed

After deployment, connect to database:
```bash
DATABASE_URL="do_postgres_url" npx drizzle-kit push
DATABASE_URL="do_postgres_url" npm run seed
```

---

## 🔐 Generating JWT Secret

Before deploying, generate a secure JWT secret:

```bash
# On Linux/Mac:
openssl rand -base64 32

# On Windows (PowerShell):
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))

# Using Node.js:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Use this as your `JWT_SECRET` environment variable.

---

## 📋 Post-Deployment Checklist

After deploying to any platform:

- [ ] App accessible via HTTPS
- [ ] Login page loads
- [ ] Database schema pushed
- [ ] Sample data seeded
- [ ] Can login with admin@manipal.edu
- [ ] Can view labs
- [ ] Can create assets
- [ ] Environment variables set correctly
- [ ] JWT_SECRET is secure (32+ characters)
- [ ] DATABASE_URL uses SSL (`?sslmode=require`)

---

## 🔧 Troubleshooting

### "DATABASE_URL is required"
**Fix**: Add DATABASE_URL to environment variables in your hosting platform

### "Cannot connect to database"
**Fix**: Ensure DATABASE_URL includes SSL parameters:
```
postgresql://user:pass@host:5432/db?sslmode=require
```

### "Login not working"
**Fix**: 
1. Check JWT_SECRET is set
2. Verify cookies are enabled (HTTPS required in production)
3. Check browser console for errors

### "No users found after seeding"
**Fix**: Run seed script again:
```bash
DATABASE_URL="your_prod_url" npm run seed
```

### Build fails
**Fix**: Check Node.js version (needs 18+) in platform settings

---

## 🌐 Custom Domain (Optional)

### Vercel
1. Project Settings → Domains
2. Add your domain
3. Update DNS records as shown

### Railway
1. Project → Settings → Domains
2. Add custom domain
3. Update DNS

### Render
1. Service → Settings → Custom Domain
2. Add domain
3. Update DNS records

---

## 📊 Monitoring & Logs

### Vercel
- Logs: Project → Deployments → View Logs
- Analytics: Project → Analytics

### Railway
- Logs: Service → Deployments → View Logs
- Metrics: Built-in CPU/Memory graphs

### Render
- Logs: Service → Logs
- Metrics: Service → Metrics

---

## 💰 Cost Estimates

### Free Tier Options:
- **Vercel**: Free (Hobby plan)
  - Database: Use Neon/Supabase free tier
  - Total: **$0/month**

- **Railway**: $5 credit/month free
  - Small app: **$0-5/month**

- **Render**: Free tier available
  - Postgres: $7/month after free trial
  - Web service: Free (spins down after inactivity)
  - Total: **$0-7/month**

### Production Plans:
- **Vercel Pro**: $20/month + database costs
- **Railway**: ~$10-20/month (usage-based)
- **Render**: ~$15-25/month
- **DigitalOcean**: ~$25-50/month

---

## 🚀 Recommended for MAHE Deployment

**For Quick Demo/Testing:**
→ Vercel + Neon (Free)

**For Department Use:**
→ Railway ($10-15/month)
→ Good balance of features and cost

**For Production (Multiple Colleges):**
→ DigitalOcean or AWS
→ Full control, scalability
→ ~$50-100/month

---

## 📞 Need Help?

1. Check platform documentation
2. Review error logs
3. Test locally first: `npm run build && npm start`
4. Verify all environment variables are set

---

## ✅ Success!

Once deployed, share these URLs with your team:

**Login Page**: `https://your-app.com/login`

**Sample Credentials:**
- Admin: admin@manipal.edu / password123
- Main Tech: main.tech@manipal.edu / password123
- Technician: tech1@manipal.edu / password123

**⚠️ Remember to change default passwords after first login!**
