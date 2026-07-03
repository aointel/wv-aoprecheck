#!/bin/bash
set -e

echo "🔄 Force Rebuild and Deploy to Production"
echo "=========================================="
echo ""

# Step 1: Clean all build artifacts
echo "🧹 Step 1: Cleaning all build artifacts..."
rm -rf dist
rm -rf node_modules/.vite
rm -rf client/node_modules/.vite

# Step 2: Fresh build
echo ""
echo "📦 Step 2: Building fresh production bundle..."
npm run build:production

# Step 3: Verify build
echo ""
echo "✅ Step 3: Verifying build output..."
if [ -f "dist/public/index.html" ]; then
    echo "✅ index.html exists"
else
    echo "❌ index.html missing!"
    exit 1
fi

if [ -f "dist/index.js" ]; then
    echo "✅ Server bundle exists"
else
    echo "❌ Server bundle missing!"
    exit 1
fi

# Step 4: Test build locally (optional)
echo ""
echo "🧪 Step 4: You can test locally with: npm start"
echo ""

# Step 5: Deploy to production
echo "🚀 Step 5: Deploying to production..."
echo ""
echo "⚠️  This will deploy to PRODUCTION!"
echo ""
read -p "Continue with production deployment? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Deploying..."
    # Force Railway to rebuild from scratch
    git add .
    git commit -m "Force rebuild: Fix blank signup page" --allow-empty
    git push origin master
    echo ""
    echo "✅ Pushed to GitHub. Railway will auto-deploy."
    echo ""
else
    echo "❌ Deployment cancelled"
    exit 0
fi

echo ""
echo "📝 Next steps:"
echo "  1. Wait for Railway deployment to complete (~2-3 minutes)"
echo "  2. Check Railway logs for any errors"
echo "  3. Test: https://aoirail-production.up.railway.app/signup"
echo "  4. Hard refresh (Ctrl+Shift+R) to clear browser cache"
echo ""

