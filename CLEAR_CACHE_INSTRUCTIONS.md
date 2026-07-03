# How to Clear Browser Cache (Force Refresh)

If you're experiencing the "Video is not defined" error or seeing old versions of the app, follow these steps to clear your browser cache:

## Quick Fix (Recommended)

**Press these keys together:**
- **Windows/Linux:** `Ctrl + Shift + R` or `Ctrl + F5`
- **Mac:** `Cmd + Shift + R` or `Cmd + Option + R`

This forces a hard refresh and bypasses the cache.

## Manual Cache Clear

### Chrome/Edge:
1. Press `F12` to open Developer Tools
2. Right-click the refresh button (next to the address bar)
3. Select "Empty Cache and Hard Reload"

OR:

1. Press `Ctrl + Shift + Delete` (Windows) or `Cmd + Shift + Delete` (Mac)
2. Select "Cached images and files"
3. Time range: "All time"
4. Click "Clear data"

### Firefox:
1. Press `Ctrl + Shift + Delete` (Windows) or `Cmd + Shift + Delete` (Mac)
2. Select "Cache"
3. Time range: "Everything"
4. Click "Clear Now"

### Safari:
1. Press `Cmd + Option + E` to clear cache
2. Or go to Safari → Preferences → Advanced → Show Develop menu
3. Then Develop → Empty Caches

## If Using Electron App:

1. Close the app completely
2. Delete the cache folder:
   - **Windows:** `%APPDATA%\AO Intelligence\Cache`
   - **Mac:** `~/Library/Application Support/AO Intelligence/Cache`
   - **Linux:** `~/.config/AO Intelligence/Cache`
3. Restart the app

## Still Not Working?

If the error persists after clearing cache:
1. Check your Node.js version: `node --version` (should be 16+)
2. Clear `node_modules` and rebuild (see TROUBLESHOOTING_VIDEO_ERROR.md)
3. Contact support with your browser version and Node.js version
