/**
 * Diagnostic Script for Electron Screenshot Capture Issue
 * 
 * Run this to check:
 * 1. If Electron main.cjs has the latest code
 * 2. If currentUserEmail is being set
 * 3. If currentSessionId is stuck
 * 4. If presentation window detection is working
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 DIAGNOSING SCREENSHOT CAPTURE ISSUE\n');
console.log('='.repeat(60));

// Check 1: Verify main.cjs has the user email tracking
console.log('\n✅ CHECK 1: Verifying main.cjs has user email tracking...');
const mainPath = path.join(__dirname, 'electron', 'main.cjs');
const mainContent = fs.readFileSync(mainPath, 'utf8');

if (mainContent.includes('currentUserEmail')) {
  console.log('   ✅ currentUserEmail variable found');
} else {
  console.log('   ❌ currentUserEmail variable NOT FOUND - this is the problem!');
}

if (mainContent.includes("ipcMain.handle('set-user-email'")) {
  console.log('   ✅ set-user-email IPC handler found');
} else {
  console.log('   ❌ set-user-email IPC handler NOT FOUND');
}

if (mainContent.includes('if (!currentSessionId && currentUserEmail)')) {
  console.log('   ✅ User email check in auto-start logic found');
} else {
  console.log('   ❌ User email check NOT FOUND');
}

// Check 2: Verify preload.cjs exposes setUserEmail
console.log('\n✅ CHECK 2: Verifying preload.cjs exposes setUserEmail...');
const preloadPath = path.join(__dirname, 'electron', 'preload.cjs');
const preloadContent = fs.readFileSync(preloadPath, 'utf8');

if (preloadContent.includes("setUserEmail: (email) => ipcRenderer.invoke('set-user-email', email)")) {
  console.log('   ✅ setUserEmail exposed in aoiCapture API');
} else {
  console.log('   ❌ setUserEmail NOT EXPOSED in preload');
}

// Check 3: Verify ElectronAutoCapture component calls setUserEmail
console.log('\n✅ CHECK 3: Verifying ElectronAutoCapture calls setUserEmail...');
const autocapturePath = path.join(__dirname, 'client', 'src', 'components', 'screen-share', 'ElectronAutoCapture.tsx');
const autocaptureContent = fs.readFileSync(autocapturePath, 'utf8');

if (autocaptureContent.includes('await window.aoiCapture.setUserEmail(userEmail)')) {
  console.log('   ✅ setUserEmail call found in component');
} else {
  console.log('   ❌ setUserEmail call NOT FOUND in component');
}

// Check 4: Look for common issues in screenshotCapture.cjs
console.log('\n✅ CHECK 4: Checking screenshot capture logic...');
const screenshotPath = path.join(__dirname, 'electron', 'screenshotCapture.cjs');
const screenshotContent = fs.readFileSync(screenshotPath, 'utf8');

if (screenshotContent.includes('desktopCapturer.getSources')) {
  console.log('   ✅ desktopCapturer.getSources found');
} else {
  console.log('   ❌ desktopCapturer.getSources NOT FOUND');
}

if (screenshotContent.includes("source = sources.find(s =>")) {
  console.log('   ✅ Window finder logic found');
  
  // Check what patterns it's looking for
  if (screenshotContent.includes("includes('hp-pro')") || 
      screenshotContent.includes("includes('hppro')")) {
    console.log('   ✅ Looking for HPPRO window');
  }
  
  if (screenshotContent.includes("includes('presentation')")) {
    console.log('   ✅ Looking for Presentation window');
  }
} else {
  console.log('   ❌ Window finder logic NOT FOUND');
}

// Check 5: Report on the upload logic
console.log('\n✅ CHECK 5: Checking screenshot upload logic...');
if (screenshotContent.includes('uploadScreenshotToServer')) {
  console.log('   ✅ Screenshot upload function found');
  
  if (screenshotContent.includes('api/live-call-board/presentations/screenshot')) {
    console.log('   ✅ Uploads to Live Call Board endpoint');
  }
} else {
  console.log('   ⚠️  No screenshot upload function');
}

// RECOMMENDATIONS
console.log('\n' + '='.repeat(60));
console.log('🔧 RECOMMENDED DEBUGGING STEPS:\n');

console.log('1. **Check if user email is being set:**');
console.log('   - Open Electron DevTools (Ctrl+Shift+I)');
console.log('   - Check console for: "💾 Stored user email for presentation tracking"');
console.log('   - If missing, ElectronAutoCapture component may not be running\n');

console.log('2. **Check if presentation window is being detected:**');
console.log('   - Open HPPRO in the Electron app');
console.log('   - Check console for: "🎯 PRESENTATION WINDOW DETECTED!"');
console.log('   - If missing, window title/URL may not match patterns\n');

console.log('3. **Check if auto-start is being blocked:**');
console.log('   - Look for: "⚠️ Cannot start capture - already capturing or no user email"');
console.log('   - If you see this, either:');
console.log('     a) currentUserEmail is null (email not set)');
console.log('     b) currentSessionId is not null (stuck session)\n');

console.log('4. **Check if screenshot capture is failing:**');
console.log('   - Look for: "⚠️ HPPRO window not found. Available windows:"');
console.log('   - This means presentation window is detected BUT screenshot cant find it');
console.log('   - Window title might have changed\n');

console.log('5. **Manual restart fix:**');
console.log('   - Close ALL Electron app windows completely');
console.log('   - Restart the app');
console.log('   - Make sure you\'re logged in BEFORE opening HPPRO');
console.log('   - Check DevTools console for all the messages above\n');

console.log('6. **Check for permission issues:**');
console.log('   - Windows may be blocking screen capture');
console.log('   - Try running Electron app as Administrator\n');

console.log('='.repeat(60));
console.log('\n✅ DIAGNOSIS COMPLETE\n');
console.log('📝 Next step: Run the Electron app with DevTools open and follow the steps above');
console.log('   to identify exactly where the flow is breaking.\n');

