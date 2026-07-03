const fs = require('fs');
const path = require('path');

let code = fs.readFileSync(path.join(__dirname, 'electron/main.cjs'), 'utf8');
const orig = code;

// 1. Replace the entire nukeRendererCachesEveryLaunch function body
code = code.replace(
  /async function nukeRendererCachesEveryLaunch\(\) \{[\s\S]*?\n\}/,
  `async function nukeRendererCachesEveryLaunch() {
  try {
    const ses = session.defaultSession;
    // Only clear service workers - preserve HTTP cache/localStorage/cookies for performance
    await ses.clearStorageData({ storages: ['serviceworkers'] });
    console.log('Service workers cleared');
  } catch (error) {
    console.error('Error clearing renderer caches:', error);
  }
}`
);

// 2. Remove the no-cache headers block for assets
code = code.replace(
  /\/\/ Force no-cache for HTML\/JS\/CSS to prevent stale bundles\s*\n\s*if \(details\.url\.match[\s\S]*?'Expires': '0';\s*\n\s*\}/,
  `// Assets are cached normally for performance`
);

// 3. Remove URL cache buster
code = code.replace(
  /const cacheBuster = `\?v=\$\{Date\.now\(\)\}`;\s*\n\s*mainWindow\.loadURL\(serverUrl \+ cacheBuster\);/,
  `mainWindow.loadURL(serverUrl);`
);

if (code === orig) {
  console.log('WARNING: No changes made - patterns not matched');
} else {
  fs.writeFileSync(path.join(__dirname, 'electron/main.cjs'), code, 'utf8');
  console.log('Changes applied successfully');
}

// Verify
const lines = code.split('\n');
const nukeIdx = lines.findIndex(l => l.includes('nukeRendererCachesEveryLaunch() {'));
const loadIdx = lines.findIndex(l => l.includes('mainWindow.loadURL('));
const cacheIdx = lines.findIndex(l => l.includes('no-cache, no-store'));

console.log('\nnukeRenderer function:');
console.log(lines.slice(nukeIdx, nukeIdx+8).join('\n'));
console.log('\nloadURL line:', lines[loadIdx]);
console.log('\nno-cache still present:', cacheIdx > -1 ? 'YES (line ' + (cacheIdx+1) + ')' : 'NO - removed');
