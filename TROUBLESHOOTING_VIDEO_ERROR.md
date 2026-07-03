# Troubleshooting "Video is not defined" Error

## Problem
The error `ReferenceError: Video is not defined` occurs on specific machines regardless of browser (Chrome or Electron).

## Root Cause
This is a **build-time** issue, not a runtime browser issue. The error suggests:
1. Corrupted `node_modules` or build cache
2. Node.js version mismatch
3. Vite build cache corruption
4. File system permissions issue

## Solution Steps (In Order)

### Step 1: Check Node.js Version
The project works with **Node.js 16.x, 18.x, 20.x, or 22.x** (flexible compatibility).

**Check your version:**
```bash
node --version
```

**Should be Node 16 or higher.** If you have an older version:
- Download Node.js 16+ from: https://nodejs.org/
- Or use nvm: `nvm install 18 && nvm use 18` (or any version 16+)

### Step 2: Clear All Caches and Rebuild

**On Windows (PowerShell):**
```powershell
# Navigate to project directory
cd c:\dev\AOIrail

# Remove node_modules and lock files
Remove-Item -Recurse -Force node_modules
Remove-Item -Force package-lock.json
Remove-Item -Recurse -Force client/node_modules
Remove-Item -Force client/package-lock.json

# Clear npm cache
npm cache clean --force

# Clear Vite build cache
Remove-Item -Recurse -Force node_modules/.vite -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .vite -ErrorAction SilentlyContinue

# Reinstall dependencies
npm install

# Rebuild
npm run build
```

**On Mac/Linux:**
```bash
# Navigate to project directory
cd /path/to/AOIrail

# Remove node_modules and lock files
rm -rf node_modules package-lock.json
rm -rf client/node_modules client/package-lock.json

# Clear npm cache
npm cache clean --force

# Clear Vite build cache
rm -rf node_modules/.vite dist .vite

# Reinstall dependencies
npm install

# Rebuild
npm run build
```

### Step 3: Verify lucide-react Installation

**Check if lucide-react is properly installed:**
```bash
npm list lucide-react
```

**Should show:** `lucide-react@0.453.0` (or similar)

**If not, reinstall it:**
```bash
npm install lucide-react@^0.453.0
```

### Step 4: Check File Permissions

**On Windows:**
- Right-click the `AOIrail` folder
- Properties → Security
- Ensure you have "Full control"

**On Mac/Linux:**
```bash
# Fix permissions
sudo chown -R $(whoami) .
chmod -R 755 .
```

### Step 5: Force Rebuild with Clean Slate

If the above doesn't work, try a completely clean rebuild:

```bash
# Remove everything
rm -rf node_modules package-lock.json dist .vite
rm -rf client/node_modules client/package-lock.json

# Clear all caches
npm cache clean --force

# Fresh install
npm install --no-cache

# Build
npm run build:production
```

## What to Download/Install

If the issue persists, ensure you have:

1. **Node.js 16.x or higher** - Download from: https://nodejs.org/ (any LTS version works)
2. **npm** (comes with Node.js)
3. **Git** (if cloning from repository)

**Note:** The build now works with Node 16, 18, 20, or 22 - no specific version required!

## Verification

After rebuilding, verify the build works:

```bash
# Start the app
npm start

# Or for development
npm run dev
```

Then test the `/connect` route to see if the error is resolved.

## Still Not Working?

If the error persists after all steps:

1. **Check the build output** - Look for any warnings about `Video` or `lucide-react`
2. **Check browser console** - Look for the exact error message and stack trace
3. **Compare with working machine** - Check Node.js version, npm version, and installed packages
4. **Try on a different machine** - This will confirm if it's truly machine-specific

## Prevention

To prevent this in the future:

1. **Use the same Node.js version** across all machines (Node 18)
2. **Commit `package-lock.json`** to ensure consistent dependencies
3. **Clear build cache** before deploying: `rm -rf dist .vite node_modules/.vite`
4. **Use CI/CD** to ensure consistent builds
