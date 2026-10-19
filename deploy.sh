#!/bin/bash

echo "🚀 Lab Asset Management System - Deployment Helper"
echo "=================================================="
echo ""

# Check if git is initialized
if [ ! -d .git ]; then
    echo "📦 Initializing Git repository..."
    git init
    git add .
    git commit -m "Initial commit - Lab Asset Management System for MAHE"
else
    echo "✅ Git repository already initialized"
fi

echo ""
echo "Choose your deployment platform:"
echo "1) Vercel (Recommended - Easiest)"
echo "2) Railway (Full-stack with DB)"
echo "3) Render (Free tier available)"
echo "4) Docker (Self-hosted)"
echo "5) Manual setup guide"
echo ""
read -p "Enter choice (1-5): " choice

case $choice in
    1)
        echo ""
        echo "📘 Deploying to Vercel"
        echo "====================="
        echo ""
        echo "Steps:"
        echo "1. Push code to GitHub (if not done):"
        echo "   git remote add origin YOUR_GITHUB_REPO_URL"
        echo "   git push -u origin main"
        echo ""
        echo "2. Go to https://vercel.com/new"
        echo "3. Import your GitHub repository"
        echo "4. Add environment variables:"
        echo "   - DATABASE_URL (get from Neon.tech or Supabase)"
        echo "   - JWT_SECRET (generate with: openssl rand -base64 32)"
        echo ""
        echo "5. Deploy!"
        echo ""
        echo "6. After deployment, seed database:"
        read -p "   Enter production DATABASE_URL: " DB_URL
        DATABASE_URL="$DB_URL" npx drizzle-kit push
        DATABASE_URL="$DB_URL" npm run seed
        echo ""
        echo "✅ Done! Your app should be live on Vercel"
        ;;
        
    2)
        echo ""
        echo "🚂 Deploying to Railway"
        echo "======================="
        echo ""
        echo "Steps:"
        echo "1. Go to https://railway.app"
        echo "2. Click 'New Project' → 'Deploy from GitHub repo'"
        echo "3. Select your repository"
        echo "4. Add PostgreSQL database (New → Database → PostgreSQL)"
        echo "5. Add environment variable:"
        echo "   - JWT_SECRET (generate with: openssl rand -base64 32)"
        echo ""
        echo "6. Deploy!"
        echo ""
        echo "7. After deployment, go to PostgreSQL → Connect"
        read -p "   Enter Railway DATABASE_URL: " DB_URL
        DATABASE_URL="$DB_URL" npx drizzle-kit push
        DATABASE_URL="$DB_URL" npm run seed
        echo ""
        echo "✅ Done! Your app should be live on Railway"
        ;;
        
    3)
        echo ""
        echo "🎨 Deploying to Render"
        echo "======================"
        echo ""
        echo "Steps:"
        echo "1. Go to https://render.com"
        echo "2. Create PostgreSQL database first"
        echo "3. New → Web Service → Connect repository"
        echo "4. Configure:"
        echo "   - Build Command: npm install && npm run build"
        echo "   - Start Command: npm start"
        echo "5. Add environment variables:"
        echo "   - DATABASE_URL (from your Render Postgres)"
        echo "   - JWT_SECRET"
        echo ""
        echo "6. Deploy!"
        echo ""
        read -p "Enter production DATABASE_URL: " DB_URL
        DATABASE_URL="$DB_URL" npx drizzle-kit push
        DATABASE_URL="$DB_URL" npm run seed
        echo ""
        echo "✅ Done! Your app should be live on Render"
        ;;
        
    4)
        echo ""
        echo "🐳 Docker Deployment"
        echo "==================="
        echo ""
        echo "Building Docker image..."
        docker build -t lab-asset-management .
        echo ""
        echo "To run with Docker:"
        echo ""
        echo "docker run -p 3000:3000 \\"
        echo "  -e DATABASE_URL='your_database_url' \\"
        echo "  -e JWT_SECRET='your_jwt_secret' \\"
        echo "  -e NODE_ENV=production \\"
        echo "  lab-asset-management"
        echo ""
        echo "Or use Docker Compose (create docker-compose.yml first)"
        ;;
        
    5)
        echo ""
        echo "📖 Manual Setup Guide"
        echo "===================="
        echo ""
        echo "See DEPLOYMENT.md for detailed instructions"
        echo ""
        cat DEPLOYMENT.md
        ;;
        
    *)
        echo "Invalid choice. Please run again and select 1-5"
        exit 1
        ;;
esac

echo ""
echo "=================================================="
echo "📚 For detailed guides, see DEPLOYMENT.md"
echo "🔐 Don't forget to change default passwords!"
echo "=================================================="
