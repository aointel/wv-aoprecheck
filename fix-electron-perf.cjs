const fs = require('fs');
const path = require('path');

let code = fs.readFileSync(path.join(__dirname, 'electron/main.cjs'), 'utf8');

// 1. Replace the aggressive cache nuke function
const oldNuke = `async function nukeRendererCachesEveryLaunch() {
  try {
    const ses = session.defaultSession;
    
    console.log('🧹 Clearing Electron renderer caches on launch...');
    
    // Clear HTTP cache
    await ses.clearCache();
    console.log('✅ HTTP cache cleared');
    
    // Clear persistent storage used by modern web apps
    await ses.clearStorageData({
      storages: [
        'serviceworkers',
        'caches',
        'localstorage',
        'indexdb',
        'websql',
        'sessionstorage',
      ],
    });
    console.log('✅ Storage data cleared (service workers, caches, localStorage, etc.)');
    
    // CRITICAL: Also clear host resolver cache and DNS cache
    await ses.clearHostResolverCache();
    console.log('✅ Host resolver cache cleared');
    
    // CRITICAL: Clear all cookies (some apps cache data in cookies)
    await ses.clearStorageData({
      storages: ['cookies'],
    });
    console.log('✅ Cookies cleared');
    
    console.log('✅ All renderer caches cleared successfully');
  } catch (error) {
    console.error('❌ Error clearing renderer caches:', error);
    // Don't throw - continue even if cache clearing fails
  }
}`;

const newNuke = `async function nukeRendererCachesEveryLaunch() {
  try {
    const ses = session.defaultSession;
    // Only clear service workers — preserve HTTP cache, localStorage, cookies
    // Clearing everything on every launch forces full re-download of all assets = massive slowdown
    await ses.clearStorageData({ storages: ['serviceworkers'] });
    console.log('Service workers cleared');
  } catch (error) {
    console.error('Error clearing renderer caches:', error);
  }
}`;

if (code.includes(oldNuke)) {
  code = code.replace(oldNuke, newNuke);
  console.log('✅ Fixed cache nuke function');
} else {
  console.log('❌ Could not find cache nuke function');
}

// 2. Remove no-cache headers injection for assets
const oldHeaders = `      details.requestHeaders['x-desktop-app'] = 'true';
      // Force no-cache for HTML/JS/CSS to prevent stale bundles
      if (details.url.match(/\\.(html|js|css|json)$/i) || details.url.includes('/assets/')) {
        details.requestHeaders['Cache-Control'] = 'no-cache, no-store, must-revalidate';
        details.requestHeaders['Pragma'] = 'no-cache';
        details.requestHeaders['Expires'] = '0';
      }`;

const newHeaders = `      details.requestHeaders['x-desktop-app'] = 'true';
      // Allow normal caching for JS/CSS assets — only the HTML page needs fresh checks`;

if (code.includes(oldHeaders)) {
  code = code.replace(oldHeaders, newHeaders);
  console.log('✅ Fixed request headers');
} else {
  console.log('❌ Could not find request headers block');
  // Try to find what's around line 404
  const lines = code.split('\n');
  console.log('Lines 400-410:', lines.slice(399, 410).join('\n'));
}

// 3. Remove cache buster from URL
const oldLoad = "  const cacheBuster = `?v=${Date.now()}`;\n  mainWindow.loadURL(serverUrl + cacheBuster);";
const newLoad = "  mainWindow.loadURL(serverUrl);";

if (code.includes(oldLoad)) {
  code = code.replace(oldLoad, newLoad);
  console.log('✅ Fixed URL cache buster');
} else {
  console.log('❌ Could not find URL cache buster');
}

fs.writeFileSync(path.join(__dirname, 'electron/main.cjs'), code, 'utf8');
console.log('\nDone. Verify changes:');
const lines = code.split('\n');
// Show line 199 area
console.log('\n--- nukeRendererCaches ---');
const idx = lines.findIndex(l => l.includes('nukeRendererCachesEveryLaunch'));
console.log(lines.slice(idx, idx+10).join('\n'));
