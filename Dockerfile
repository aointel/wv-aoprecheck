# Production Dockerfile for Railway
FROM node:18-alpine

# Install security updates, build dependencies, Git LFS, curl, and system Chromium for Playwright jobs
# Combine commands to reduce layers and speed up build
RUN apk update && apk upgrade && apk add --no-cache dumb-init git git-lfs curl wget chromium nss freetype harfbuzz ca-certificates ttf-freefont && \
    rm -rf /var/cache/apk/*

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Set working directory
WORKDIR /app

# Copy package files first for better Docker layer caching
COPY package*.json ./

# Install ALL dependencies (needed for build)
# Use npm ci for faster, more reliable installs (requires package-lock.json)
# This layer will be cached if package.json doesn't change
RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund

# Copy source code (this invalidates cache when code changes)
COPY --chown=nextjs:nodejs . .

# Copy video file to a backup location in the container (since LFS doesn't work in Docker build)
# This will be copied to the volume on startup
RUN mkdir -p attached_assets_backup && \
    if [ -d "attached_assets" ]; then cp -r attached_assets/* attached_assets_backup/ 2>/dev/null || true; fi

# Copy init script
COPY init-volume.sh /app/init-volume.sh
RUN chmod +x /app/init-volume.sh

# Build the application
RUN npm run build

# Don't prune dependencies - server needs some dev deps like vite at runtime
# RUN npm prune --production

# Create directories and set permissions for non-root user
# Also make dist/public writable so runtime injection can modify index.html
RUN mkdir -p /app/uploads /app/attached_assets /app/dist/public && \
    chown -R nextjs:nodejs /app/uploads /app/attached_assets /app/dist /app/dist/public && \
    chmod -R 755 /app/dist

# Switch to non-root user
USER nextjs

# Expose port 5000 (Cloud Run default)
EXPOSE 5000

# Set production environment
ENV NODE_ENV=production
ENV PORT=5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/health || exit 1

# Start the application with dumb-init for proper signal handling
# Run init script first, then start the app
CMD ["/bin/sh", "-c", "echo '🚀 Starting init script...' && /app/init-volume.sh && echo '🚀 Starting server...' && dumb-init npm start"]