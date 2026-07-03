#!/bin/bash
set -e

echo "🧪 Starting STAGING deployment..."
echo "================================"
echo ""
echo "⚠️  This will deploy to STAGING environment"
echo ""

# Clean previous build
echo "🧹 Cleaning old build artifacts..."
rm -rf dist

# Build for staging
echo "📦 Building for STAGING..."
NODE_ENV=staging vite build --mode staging

# Build backend
echo "⚙️ Building backend..."
esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist --log-level=error

echo "✅ Build complete!"
echo ""
echo "📤 Ready to deploy to staging"
echo ""
echo "Choose your deployment target:"
echo "  Railway: railway up --config railway.staging.json"
echo "  GCloud:  gcloud app deploy app.staging.yaml --project=YOUR_PROJECT_ID"
echo ""

