#!/bin/bash

echo "🚂 Railway Deployment Script"
echo "============================"
echo ""

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Installing..."
    npm install -g @railway/cli
else
    echo "✅ Railway CLI is installed"
fi

echo ""
echo "📝 Steps to deploy:"
echo ""
echo "1. Login to Railway:"
echo "   railway login"
echo ""
echo "2. Initialize project:"
echo "   railway init"
echo ""
echo "3. Deploy:"
echo "   railway up"
echo ""
echo "4. Create public domain:"
echo "   railway domain create"
echo ""
echo "Ready to start? Run: railway login"

