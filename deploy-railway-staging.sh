#!/bin/bash
set -e

echo "🧪 Railway STAGING Deployment"
echo "=============================="
echo ""

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Installing..."
    npm install -g @railway/cli
else
    echo "✅ Railway CLI is installed"
fi

echo ""
echo "🔐 Make sure you're logged in to Railway..."
railway whoami || railway login

echo ""
echo "🎯 Deploying to STAGING environment..."
echo ""

# Deploy to staging using staging config
railway up --service staging --config railway.staging.json

echo ""
echo "✅ Deployment to STAGING complete!"
echo ""
echo "📝 Next steps:"
echo "  - Test your changes in staging"
echo "  - Verify everything works correctly"
echo "  - Only deploy to production after staging approval"
echo ""

