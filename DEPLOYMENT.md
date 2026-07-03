# ConnectNow Deployment Guide

## Overview
ConnectNow is a React Single Page Application (SPA) with client-side routing. The development server works perfectly, but production deployment requires proper server configuration to handle SPA routing.

## Development vs Production

### Development (Working)
- Vite dev server automatically handles client-side routing
- All routes (`/dashboard`, `/connect`, etc.) work correctly
- Hot reload and development features enabled

### Production (Needs Fix)
- Express.js serves static files from `dist/public/`
- Client-side routes need server fallback to `index.html`
- All non-API routes should serve the React app

## Current Issue
When deployed to live server:
- Root URL (`/`) works fine - serves index.html
- Direct navigation to `/dashboard` or `/connect` returns 404
- Client-side navigation within the app works
- Only initial page loads to specific routes fail

## Required Fix
The production server needs a fallback route that:
1. Serves static assets normally (CSS, JS, images)
2. For any route that doesn't exist, serves `index.html`
3. Excludes API routes from the fallback

## Build Process
```bash
npm run build  # Creates dist/public/ with static files
npm start      # Runs production server
```

## File Structure
```
dist/
  public/
    index.html     # Main app entry point
    assets/
      index-*.js   # Bundled JavaScript
      index-*.css  # Bundled CSS
  index.js         # Server bundle
```

## Server Configuration Notes
- Development: Uses Vite middleware with automatic SPA fallback
- Production: Uses Express static file serving (needs SPA fallback)
- Port: Always runs on port 5000 (both dev and production)
- Database: Dual Supabase/PostgreSQL support with automatic fallback

## Deployment Checklist
- [ ] Build completes successfully (`npm run build`)
- [ ] Static files generated in `dist/public/`
- [ ] Server starts without errors (`npm start`)
- [ ] Root URL loads correctly
- [ ] Direct navigation to all routes works
- [ ] API endpoints remain functional
- [ ] Database connections established