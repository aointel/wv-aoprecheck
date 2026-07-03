#!/bin/bash
set -e

echo "🚀 Starting production build..."

# Clean previous build
echo "🧹 Cleaning old build artifacts..."
rm -rf dist

# Build frontend (Vite)
echo "📦 Building frontend with Vite..."
vite build --mode production

# Build backend (esbuild)
echo "⚙️ Building backend with esbuild..."
esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist --log-level=error

echo "✅ Build complete!"
ls -lah dist/

