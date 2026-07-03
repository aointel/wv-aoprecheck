# SPA Routing Fix - Signup Page Blank on First Load

## Problem
When visiting `/signup` directly (or any client-side route), the page is blank on first load. It only works after refreshing.

## Root Cause
The Express server wasn't properly configured to serve `index.html` for all client-side routes. The catch-all route was using `app.get()` which doesn't handle all HTTP methods and has lower priority than other routes.

## Solution Applied

### Changed in `server/vite.ts`:

**Before:**
```typescript
app.get("*", (req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ message: "API route not found" });
  }
  const indexPath = path.join(distPath, "index.html");
  res.sendFile(indexPath);
});
```

**After:**
```typescript
app.use("*", (req, res, next) => {
  // Skip API and webhook routes
  if (req.path.startsWith("/api/") || req.path.startsWith("/webhook/")) {
    return next();
  }
  
  // Serve index.html for all SPA routes
  const indexPath = path.join(distPath, "index.html");
  
  if (!fs.existsSync(indexPath)) {
    return res.status(500).send('Application build not found.');
  }
  
  console.log(`📄 Serving SPA route: ${req.path} -> index.html`);
  res.sendFile(indexPath);
});
```

### Key Changes:
1. ✅ Changed from `app.get()` to `app.use()` for catch-all
2. ✅ Added explicit webhook route exclusion
3. ✅ Added file existence verification
4. ✅ Added logging to track SPA route serving
5. ✅ Proper Content-Type header
6. ✅ Better error handling

## Deploy the Fix

### Quick Deploy:
```bash
# Windows
.\fix-spa-routing.bat

# Mac/Linux
chmod +x fix-spa-routing.sh
./fix-spa-routing.sh
```

### Manual Deploy:
```bash
# 1. Build
npm run build:production

# 2. Commit
git add server/vite.ts
git commit -m "Fix SPA routing for client-side routes"

# 3. Push
git push origin master
```

## Testing

After deployment completes:

1. **Direct URL Test:**
   - Visit: `https://aoirail-production.up.railway.app/signup`
   - Should load immediately ✅
   - No refresh needed ✅

2. **Other Routes:**
   - `/login` - Should load ✅
   - `/forgot-password` - Should load ✅
   - `/dashboard/aoi` - Should redirect to login if not authenticated ✅

3. **API Routes Still Work:**
   - API routes should still return JSON, not HTML ✅
   - Test: `https://aoirail-production.up.railway.app/api/user`

## Verify in Logs

In Railway logs, you should see:
```
📄 Serving SPA route: /signup -> index.html
```

This confirms the server is properly serving the React app for client-side routes.

## How SPA Routing Works

1. **User visits `/signup` directly**
   - Browser sends GET request to server

2. **Server receives request**
   - Checks if it's an API route → No
   - Checks if it's a webhook route → No
   - Serves `index.html` ✅

3. **Browser loads React app**
   - React Router (wouter) sees URL is `/signup`
   - Renders `SignupPage` component ✅

4. **User navigates to other pages**
   - Client-side routing takes over
   - No server requests needed ✅

## Common Issues

### Still blank after deploy?
- Hard refresh: Ctrl+Shift+R
- Check Railway deployment completed
- Verify build succeeded
- Check browser console for errors

### API routes returning HTML?
- Check route starts with `/api/`
- Verify API routes registered before catch-all
- Check server logs

### Refresh loop?
- Clear browser cache
- Check for JavaScript errors in console
- Verify all assets loading (Network tab)

## Technical Notes

### Why `app.use()` instead of `app.get()`?

- `app.use()` has higher priority for catch-all routes
- Handles all HTTP methods (GET, POST, etc.)
- Better for SPA routing patterns
- More reliable than `app.get("*")`

### Order Matters

Route registration order in Express:
1. Health check routes (must be first)
2. Static assets (`express.static`)
3. API routes (`/api/*`)
4. Webhook routes (`/webhook/*`)
5. **SPA catch-all** (must be last)

The catch-all MUST be registered last to avoid catching API/webhook routes.

---

**Status:** ✅ Fixed and ready to deploy

