#!/bin/bash

echo ""
echo "================================================"
echo "🚨 PRODUCTION DEPLOYMENT - APPROVAL REQUIRED"
echo "================================================"
echo ""
echo "This will deploy to LIVE PRODUCTION:"
echo "  https://aoirail-production.up.railway.app"
echo ""
echo "⚠️  STOP! Have you completed the checklist?"
echo ""
echo "✅ Tested in staging: aoirail-beta-staging.up.railway.app"
echo "✅ Verified all features work correctly"
echo "✅ Checked Railway logs for errors"
echo "✅ No console errors in browser"
echo "✅ Tested login/signup flows"
echo "✅ Got APPROVAL from authorized person"
echo ""
echo "================================================"
echo ""

# Check we're not already on master
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" = "master" ]; then
    echo "❌ ERROR: You are already on master branch!"
    echo "   Please switch to staging first."
    echo ""
    echo "   Run: git checkout staging"
    echo ""
    exit 1
fi

echo "📋 APPROVAL REQUIRED"
echo ""
read -p "Enter name of person who approved this deployment: " APPROVER

if [ -z "$APPROVER" ]; then
    echo ""
    echo "❌ Deployment cancelled - No approver name provided"
    echo ""
    exit 1
fi

echo ""
echo "🔍 Checking staging branch status..."
git fetch origin
if ! git diff --quiet staging origin/staging; then
    echo ""
    echo "⚠️  WARNING: Local staging branch differs from remote!"
    echo "   Push to staging first or pull latest changes."
    echo ""
    exit 1
fi

echo ""
echo "⚠️  FINAL CONFIRMATION"
echo ""
echo "You are about to deploy to PRODUCTION"
echo "Approved by: $APPROVER"
echo ""
read -p "Type 'DEPLOY TO PRODUCTION' to confirm (or anything else to cancel): " CONFIRM

if [ "$CONFIRM" != "DEPLOY TO PRODUCTION" ]; then
    echo ""
    echo "❌ Deployment cancelled - Confirmation text did not match"
    echo ""
    exit 1
fi

echo ""
echo "================================================"
echo "🚀 Starting Production Deployment"
echo "================================================"
echo ""

echo "📝 Step 1: Switching to master branch..."
git checkout master
if [ $? -ne 0 ]; then
    echo "❌ Failed to switch to master branch"
    exit 1
fi

echo ""
echo "📥 Step 2: Pulling latest master..."
git pull origin master
if [ $? -ne 0 ]; then
    echo "❌ Failed to pull master"
    exit 1
fi

echo ""
echo "🔀 Step 3: Merging staging into master..."
git merge staging -m "Production deployment approved by $APPROVER"
if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Merge failed! Resolve conflicts manually."
    echo ""
    exit 1
fi

echo ""
echo "📤 Step 4: Pushing to production..."
git push origin master
if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Push to production failed!"
    echo ""
    exit 1
fi

echo ""
echo "✅ SUCCESS! Deployed to production"
echo ""
echo "🔄 Step 5: Switching back to staging branch..."
git checkout staging

echo ""
echo "================================================"
echo "✅ PRODUCTION DEPLOYMENT COMPLETE"
echo "================================================"
echo ""
echo "Deployed by: $APPROVER"
echo "Production URL: https://aoirail-production.up.railway.app"
echo ""
echo "📋 Post-Deployment Checklist:"
echo "  1. Wait 2-3 minutes for Railway to deploy"
echo "  2. Test production URL"
echo "  3. Check Railway production logs"
echo "  4. Verify critical features work"
echo "  5. Monitor for errors"
echo ""
echo "Railway will auto-deploy in ~2-3 minutes"
echo ""

