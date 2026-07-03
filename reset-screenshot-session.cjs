/**
 * Emergency Reset Script
 * 
 * This script helps reset stuck screenshot sessions by:
 * 1. Clearing any local session data
 * 2. Providing instructions for manual reset
 */

console.log('🔄 SCREENSHOT CAPTURE EMERGENCY RESET\n');
console.log('='.repeat(60));

console.log('\n⚠️  IMPORTANT: This won\'t actually clear Electron\'s memory');
console.log('   (that requires restarting the app)\n');

console.log('📋 RESET CHECKLIST:\n');

console.log('✅ Step 1: Close ALL Electron App Windows');
console.log('   - Close all HPPRO windows');
console.log('   - Close the main app window');
console.log('   - Make sure app is completely quit\n');

console.log('✅ Step 2: Verify App is Closed');
console.log('   - Check Task Manager (Ctrl+Shift+Esc)');
console.log('   - Look for "Electron" or "ConnectNow" process');
console.log('   - End the process if it\'s still running\n');

console.log('✅ Step 3: Rebuild (if code was updated)');
console.log('   - Run: npm run build-electron');
console.log('   - Wait for build to complete\n');

console.log('✅ Step 4: Start App with DevTools');
console.log('   - Launch the Electron app');
console.log('   - Press Ctrl+Shift+I to open DevTools IMMEDIATELY');
console.log('   - Keep Console tab open\n');

console.log('✅ Step 5: Log In FIRST');
console.log('   - Log in to your account');
console.log('   - Wait for login to complete');
console.log('   - Look for: "✅ Sent REAL user email to Electron main process"');
console.log('   - If you don\'t see this, ElectronAutoCapture component isn\'t running\n');

console.log('✅ Step 6: Open HPPRO');
console.log('   - NOW open HPPRO (after logging in)');
console.log('   - Watch the console logs');
console.log('   - Look for: "🎯 PRESENTATION WINDOW DETECTED!"\n');

console.log('✅ Step 7: Verify Screenshot Capture');
console.log('   - Look for: "✅ CONDITIONS MET - STARTING AUTO-CAPTURE"');
console.log('   - Look for: "📸 Screenshot 1: screenshot-0001.png"');
console.log('   - Screenshots should appear every 30 seconds\n');

console.log('='.repeat(60));

console.log('\n❓ WHAT IF IT STILL DOESN\'T WORK?\n');

console.log('Check these specific error messages:\n');

console.log('1️⃣  "❌ Reason: No user email set"');
console.log('   → You opened HPPRO before logging in');
console.log('   → Close HPPRO, make sure you\'re logged in, then reopen\n');

console.log('2️⃣  "⚠️ Reason: Session already active"');
console.log('   → Session is stuck from previous run');
console.log('   → You didn\'t fully close the app - see Step 1 & 2 above\n');

console.log('3️⃣  "⚠️ HPPRO window not found. Available windows:"');
console.log('   → Presentation detected but screenshot can\'t find it');
console.log('   → Check if HPPRO window title changed');
console.log('   → May need to update window patterns in screenshotCapture.cjs\n');

console.log('4️⃣  "❌ Not a presentation window"');
console.log('   → Window title/URL doesn\'t match patterns');
console.log('   → Check actual title/URL in logs');
console.log('   → May need to update detection patterns in main.cjs\n');

console.log('5️⃣  Nothing in console at all');
console.log('   → DevTools might be showing browser console, not Electron main console');
console.log('   → Try: Right-click → Inspect → Console tab\n');

console.log('='.repeat(60));
console.log('\n✅ RESET COMPLETE\n');
console.log('Follow the steps above to fully reset the screenshot capture system.\n');

