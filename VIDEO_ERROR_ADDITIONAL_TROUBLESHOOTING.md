# Additional Troubleshooting for "Video is not defined" Error

## Already Addressed ✅
- Tree-shaking of unused imports
- Build environment/Node.js version compatibility
- Cache-busting mechanisms
- Module resolution (dedupe, commonjsOptions)

## Other Potential Causes

### 1. **Browser Extensions Interference** 🚫
Some browser extensions can interfere with JavaScript module loading:
- **Ad blockers** (uBlock Origin, AdBlock Plus)
- **Privacy extensions** (Privacy Badger, Ghostery)
- **VPN browser extensions**
- **Script blockers**

**Fix:**
- Test in **Incognito/Private mode** (extensions usually disabled)
- Disable extensions one by one to identify the culprit
- Add the site to extension whitelist

### 2. **Network/CDN Issues** 🌐
If the bundle is served from a CDN or through a proxy:
- Partial bundle load (network interruption)
- CDN caching old versions
- Proxy caching issues
- Network timeout during module load

**Fix:**
- Check browser Network tab for failed requests
- Try different network (phone hotspot, different WiFi)
- Check if CDN/proxy has cache headers set correctly

### 3. **Browser Compatibility** 💻
Older browsers or specific versions might have ES module issues:
- Safari < 16.4 (ES module support issues)
- Chrome < 90 (older module resolution)
- Firefox < 89 (module loading quirks)

**Fix:**
- Update browser to latest version
- Check browser console for module loading errors
- Test in different browser (Chrome, Firefox, Edge)

### 4. **Code Splitting/Chunk Loading** 📦
If `VideoCallModal` is in a separate chunk and that chunk fails to load:
- Network error loading the chunk
- Chunk filename mismatch
- Chunk not included in build

**Fix:**
- Check Network tab for failed chunk requests
- Verify all chunks are loading (look for `assets/*.js` files)
- Check browser console for chunk loading errors

### 5. **Service Worker Persistence** 🔄
Even though we unregister service workers, they might still be active:
- Service worker registered before our unregister code runs
- Service worker cache still serving old bundle
- Multiple service workers registered

**Fix:**
- Open DevTools → Application → Service Workers → Unregister all
- Clear "Cache Storage" in DevTools
- Hard refresh (Ctrl+Shift+R / Cmd+Shift+R)

### 6. **Electron-Specific Issues** ⚡
If using Electron app:
- Electron's module resolution differs from browser
- Preload script interference
- Context isolation issues

**Fix:**
- Check Electron console (not browser console)
- Verify Electron version is up to date
- Check if issue occurs in browser version too

### 7. **Multiple lucide-react Versions** 📚
Even with `dedupe`, if there are multiple versions:
- Different versions in different parts of node_modules
- Lock file out of sync
- Package manager issues

**Fix:**
```bash
# Check for multiple versions
npm list lucide-react

# Force reinstall
rm -rf node_modules package-lock.json
npm install
```

### 8. **Build Artifact Issues** 🔨
The build might not be generating correctly:
- Build process interrupted
- Corrupted build artifacts
- Missing files in dist/

**Fix:**
- Rebuild from scratch:
  ```bash
  rm -rf dist node_modules/.vite
  npm run build
  ```
- Check if `dist/public/assets/` contains all chunks
- Verify build completes without errors

### 9. **Source Map Issues** 🗺️
Broken source maps can cause errors to appear in wrong places:
- Source map points to wrong file
- Source map not generated
- Browser trying to use broken source map

**Fix:**
- Disable source maps in browser DevTools
- Check if error location makes sense
- Verify source maps are generated in build

### 10. **Browser DevTools/Console Issues** 🐛
Sometimes the error message is misleading:
- Error occurs in different file but shows in wrong place
- Console not showing full stack trace
- Error swallowed by try/catch

**Fix:**
- Enable "Pause on exceptions" in DevTools
- Check "Preserve log" in Console
- Look at full stack trace, not just error message

## Diagnostic Steps

### Step 1: Check Browser Console
```javascript
// Run in browser console
console.log('Video import test:', typeof Video);
console.log('lucide-react test:', typeof require !== 'undefined' ? require('lucide-react') : 'ES modules');
```

### Step 2: Check Network Tab
1. Open DevTools → Network tab
2. Filter by "JS"
3. Look for:
   - Failed requests (red)
   - 404 errors
   - Partial loads
   - Missing chunks

### Step 3: Check Application Tab
1. DevTools → Application
2. Check:
   - Service Workers (should be none)
   - Cache Storage (should be empty or cleared)
   - Local Storage (check for old data)

### Step 4: Test in Different Environment
- Different browser
- Different network
- Incognito mode
- Different device

### Step 5: Check Build Output
```bash
# After building, check if Video is in the bundle
grep -r "Video" dist/public/assets/*.js
# Should find references to Video icon
```

## Quick Fixes to Try

1. **Hard Refresh**: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
2. **Clear All Data**: DevTools → Application → Clear storage → Clear site data
3. **Disable Extensions**: Test in Incognito mode
4. **Different Browser**: Try Chrome, Firefox, Edge
5. **Different Network**: Try phone hotspot
6. **Rebuild**: Delete `dist/` and rebuild
7. **Reinstall**: Delete `node_modules` and reinstall

## If Still Not Working

1. **Check exact error message** - Is it "Video is not defined" or something else?
2. **Check error location** - Which file/line is the error on?
3. **Check browser version** - What browser and version?
4. **Check network** - Any failed requests in Network tab?
5. **Check console** - Any other errors before this one?

## Reporting the Issue

If the error persists, provide:
- Browser name and version
- Exact error message and stack trace
- Screenshot of Network tab (showing JS files)
- Screenshot of Console (showing all errors)
- Whether it works in Incognito mode
- Whether it works in different browser
