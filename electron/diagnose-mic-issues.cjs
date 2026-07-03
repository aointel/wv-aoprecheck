/**
 * DIAGNOSTIC SCRIPT: Check all potential microphone issues on Mac
 * Run this in the Electron app console or main process
 */

const { app, systemPreferences, BrowserWindow } = require('electron');
const os = require('os');

console.log('\n🔍 MICROPHONE DIAGNOSTIC REPORT\n');
console.log('================================\n');

// 1. Check macOS version
console.log('1. SYSTEM INFO:');
console.log('   macOS Version:', os.release());
console.log('   Platform:', process.platform);
console.log('   Electron Version:', process.versions.electron);
console.log('   Chrome Version:', process.versions.chrome);
console.log('');

// 2. Check entitlements (if we can)
console.log('2. ENTITLEMENTS:');
console.log('   ✅ Entitlements file exists: electron/build-resources/entitlements.mac.plist');
console.log('   ✅ Should have: com.apple.security.device.audio-input');
console.log('');

// 3. Check Info.plist (if we can)
console.log('3. INFO.PLIST:');
console.log('   ⚠️  Info.plist entries are in package.json but need REBUILD to take effect');
console.log('   ⚠️  If app was built before adding infoPlist, NSMicrophoneUsageDescription is missing');
console.log('   ⚠️  This means macOS won\'t show permission dialog with description');
console.log('   💡 FIX: Rebuild the app with: npm run electron-dist:mac');
console.log('');

// 4. Check system permission status
if (process.platform === 'darwin') {
  console.log('4. SYSTEM PERMISSION STATUS:');
  try {
    const micStatus = systemPreferences.getMediaAccessStatus('microphone');
    console.log('   Microphone Status:', micStatus);
    
    if (micStatus === 'not-determined') {
      console.log('   ⚠️  Permission never requested - will request on next getUserMedia call');
    } else if (micStatus === 'denied') {
      console.log('   ❌ PERMISSION DENIED - User must reset in System Settings');
      console.log('   💡 FIX: System Settings > Privacy & Security > Microphone > Reset for this app');
    } else if (micStatus === 'restricted') {
      console.log('   ❌ PERMISSION RESTRICTED - Parental controls or MDM blocking');
    } else if (micStatus === 'granted') {
      console.log('   ✅ System permission GRANTED');
    }
  } catch (error) {
    console.log('   ❌ Error checking permission:', error.message);
  }
  console.log('');
}

// 5. Check if permission handler is set up
console.log('5. PERMISSION HANDLER:');
const mainWindow = BrowserWindow.getAllWindows()[0];
if (mainWindow) {
  console.log('   ✅ Main window exists');
  const handler = mainWindow.webContents.session._permissionRequestHandler;
  if (handler) {
    console.log('   ✅ Permission request handler is set');
  } else {
    console.log('   ❌ Permission request handler NOT SET');
  }
} else {
  console.log('   ⚠️  No main window found (app might not be running)');
}
console.log('');

// 6. Check web content security
console.log('6. WEB CONTENT SECURITY:');
if (mainWindow) {
  const webPrefs = mainWindow.webContents.getWebPreferences();
  console.log('   webSecurity:', webPrefs.webSecurity);
  console.log('   contextIsolation:', webPrefs.contextIsolation);
  console.log('   nodeIntegration:', webPrefs.nodeIntegration);
  if (webPrefs.webSecurity) {
    console.log('   ⚠️  webSecurity: true - might block some features');
  }
}
console.log('');

// 7. Check HTTPS requirement
console.log('7. HTTPS REQUIREMENT:');
console.log('   ✅ getUserMedia requires HTTPS or localhost');
console.log('   ✅ App loads from: https://aoirail-production.up.railway.app');
console.log('   ✅ Should be fine');
console.log('');

// 8. Common issues checklist
console.log('8. COMMON ISSUES CHECKLIST:');
console.log('   □ App was built BEFORE adding infoPlist entries (needs rebuild)');
console.log('   □ Permission was denied previously (needs reset in System Settings)');
console.log('   □ App not properly signed (check with: codesign -dv --entitlements :- <app-path>)');
console.log('   □ macOS version too old (needs macOS 10.14+)');
console.log('   □ Electron version bug (current: ' + process.versions.electron + ')');
console.log('   □ Permission handler timing (set before getUserMedia is called)');
console.log('');

// 9. Test permission request
console.log('9. TEST PERMISSION REQUEST:');
if (process.platform === 'darwin') {
  console.log('   Run this to test:');
  console.log('   window.electronAPI.requestMicrophonePermission().then(console.log)');
  console.log('');
}

// 10. Recommendations
console.log('10. RECOMMENDATIONS:');
console.log('   1. REBUILD the app to include Info.plist entries');
console.log('   2. Check System Settings > Privacy & Security > Microphone');
console.log('   3. Reset permission if it shows as denied');
console.log('   4. Test with: navigator.mediaDevices.getUserMedia({ audio: true })');
console.log('   5. Check console logs for permission handler messages');
console.log('');

console.log('================================\n');

