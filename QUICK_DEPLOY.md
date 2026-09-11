# 🚀 Quick Deploy - Lab Asset Management System

## Option 1: One-Click Deploy to Vercel (Easiest!)

### Step 1: Prepare Database

Choose ONE of these free database options:

#### A. Neon (Recommended - Free Forever)
1. Go to https://neon.tech
2. Sign up with GitHub
3. Create new project: "lab-asset-management"
4. Copy **Connection String** (looks like: `postgresql://user:pass@host/db`)

#### B. Supabase (Good Alternative)
1. Go to https://supabase.com
2. Create new project
3. Go to Settings → Database → Connection Pooling
4. Copy **Connection String**

#### C. Vercel Postgres (If you have Vercel Pro)
1. In Vercel dashboard → Storage → Create Database
2. Select Postgres
3. Copy connection string

### Step 2: Deploy to Vercel

Click this button:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/lab-asset-management)

**Or manually:**

1. Push your code to GitHub (see instructions below)
2. Go to https://vercel.com/new
3. Click "Import Git Repository"
4. Select your repository
5. Add environment variables:
   ```
   DATABASE_URL=your_neon_or_supabase_url
   JWT_SECRET=your_generated_secret
   ```

6. Click **Deploy**

### Step 3: Initialize Database

After deployment succeeds:

```bash
# Install Vercel CLI
npm i -g vercel

# Link to your project
vercel link

# Set environment variable locally for seeding
export DATABASE_URL="your_production_database_url"

# Push schema to database
npx drizzle-kit push

# Seed with initial data (colleges, labs, users)
npm run seed
```

### Step 4: Access Your App!

Your app will be live at: `https://your-project.vercel.app`

**Login with:**
- Email: `admin@manipal.edu`
- Password: `password123`

**⚠️ IMPORTANT: Change this password immediately after first login!**

---

## Option 2: Push to GitHub First

If you don't have your code on GitHub yet:

```bash
# 1. Initialize git (if not done)
git init

# 2. Add all files
git add .

# 3. Commit
git commit -m "Lab Asset Management System for MAHE"

# 4. Create repository on GitHub
# Go to https://github.com/new
# Name it: lab-asset-management

# 5. Add remote and push
git remote add origin https://github.com/YOUR_USERNAME/lab-asset-management.git
git branch -M main
git push -u origin main
```

Now go back to Option 1, Step 2!

---

## Option 3: Deploy to Railway (Alternative)

### Super Quick:

1. Go to https://railway.app
2. Click "Start a New Project"
3. Select "Deploy from GitHub repo"
4. Select your repository
5. Click "Add PostgreSQL" (automatically adds database!)
6. Add environment variable:
   ```
   JWT_SECRET=your_generated_secret
   ```
7. Deploy!
8. Run seed:
   ```bash
   # Get DATABASE_URL from Railway dashboard
   DATABASE_URL="railway_url" npx drizzle-kit push
   DATABASE_URL="railway_url" npm run seed
   ```

**Cost**: $5 free credit, then ~$5-10/month

---

## 🔐 Generate JWT Secret

Before deploying, generate a secure secret:

```bash
# Option 1: OpenSSL (Linux/Mac)
openssl rand -base64 32

# Option 2: Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Option 3: Online
# Go to: https://generate-secret.vercel.app/32
```

Copy the output and use it as your `JWT_SECRET`

---

## ✅ Post-Deployment Checklist

- [ ] App loads at your URL
- [ ] Can access `/login` page
- [ ] Database schema pushed (`npx drizzle-kit push`)
- [ ] Sample data seeded (`npm run seed`)
- [ ] Can login with admin@manipal.edu
- [ ] Can see labs page
- [ ] Can create assets
- [ ] **Changed default passwords!**

---

## 🆘 Troubleshooting

### "Error: DATABASE_URL is required"
**Fix**: Add DATABASE_URL to environment variables in Vercel/Railway

### "Can't login"
**Fix**: 
1. Check JWT_SECRET is set
2. Make sure you're using HTTPS (not HTTP)
3. Clear browser cookies and try again

### "No data showing"
**Fix**: You forgot to run the seed script
```bash
DATABASE_URL="your_url" npm run seed
```

### Build fails
**Fix**: Check logs, usually missing environment variables

---

## 🎉 Success!

Once deployed, you'll have:

✅ **Public URL**: Share with your team  
✅ **HTTPS**: Secure by default  
✅ **Database**: Hosted and managed  
✅ **Auto-deployments**: Push to GitHub = auto-deploy  

**Next Steps:**
1. Add your own colleges and labs
2. Create user accounts for your team
3. Start managing assets!

---

## 📧 Share with Your Team

**Login Page**: `https://your-app.vercel.app/login`

**Demo Accounts:**
- **Admin**: admin@manipal.edu / password123
- **Main Tech**: main.tech@manipal.edu / password123
- **Technician**: tech1@manipal.edu / password123

**Remember to create real accounts and disable/delete demo accounts in production!**

---

## 💡 Pro Tips

1. **Custom Domain**: Add your domain in Vercel settings (e.g., assets.manipal.edu)
2. **Backups**: Neon/Supabase do automatic backups
3. **Monitoring**: Enable Vercel Analytics for usage stats
4. **Scaling**: Both platforms scale automatically

---

## 📞 Need Help?

1. Check deployment logs in your platform dashboard
2. See full guide: [DEPLOYMENT.md](./DEPLOYMENT.md)
3. Review error messages carefully
4. Test locally first: `npm run build && npm start`

**Happy deploying! 🚀**
