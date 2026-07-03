/**
 * ENHANCED DEBUG VERSION of main.cjs
 * Copy this to main.cjs to get detailed logging
 * 
 * This adds comprehensive console logging to help identify:
 * - If currentUserEmail is being set
 * - If currentSessionId is stuck
 * - Why screenshot capture isn't starting
 */

// Add this at the top of the browser-window-created handler (line 197)
// to debug the presentation detection

// REPLACE the browser-window-created handler with this version:

app.on('browser-window-created', (event, window) => {
  // Wait a bit for the window to load and get its URL
  setTimeout(() => {
    const title = window.getTitle();
    const url = window.webContents.getURL();
    
    console.log('🔍 NEW WINDOW CREATED:');
    console.log('   Title:', title);
    console.log('   URL:', url);
    console.log('   Current Session ID:', currentSessionId);
    console.log('   Current User Email:', currentUserEmail);
    
    // Check if it's HPPRO or other presentation tool
    const isPresentation = 
      title.includes('Presentation') || 
      title.includes('Present') ||
      title.includes('AOI Presentation') ||
      url.includes('hppro.planetaltig.com') ||
      url.includes('present') ||
      url.includes('deck') ||
      url.includes('slide');
    
    console.log('   Is Presentation?', isPresentation);
    
    if (isPresentation) {
      console.log('🎯 PRESENTATION WINDOW DETECTED!');
      console.log('   Title:', title);
      console.log('   URL:', url);
      presentationWindows.add(window);
      
      // AUTO-START SCREENSHOT CAPTURE (don't wait for frontend!)
      console.log('🔍 CHECKING AUTO-START CONDITIONS:');
      console.log('   currentSessionId:', currentSessionId);
      console.log('   currentUserEmail:', currentUserEmail);
      console.log('   !currentSessionId:', !currentSessionId);
      console.log('   currentUserEmail exists:', !!currentUserEmail);
      
      if (!currentSessionId && currentUserEmail) {
        console.log('✅ CONDITIONS MET - STARTING AUTO-CAPTURE');
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        console.log('🚀 AUTO-STARTING screenshot capture for session:', sessionId);
        
        // ... rest of the start logic
      } else {
        console.log('❌ CONDITIONS NOT MET - AUTO-CAPTURE BLOCKED');
        if (currentSessionId) {
          console.log('   Reason: Session already active:', currentSessionId);
          console.log('   💡 Fix: Call stopCapture() or restart the app');
        }
        if (!currentUserEmail) {
          console.log('   Reason: No user email set');
          console.log('   💡 Fix: Make sure user is logged in and ElectronAutoCapture component is mounted');
        }
      }
      
      // ... rest of handler
    } else {
      console.log('❌ Not a presentation window');
    }
  }, 500);
});

// Also add this logging to the set-user-email handler:
ipcMain.handle('set-user-email', async (event, email) => {
  console.log('📧 SET-USER-EMAIL CALLED');
  console.log('   Previous email:', currentUserEmail);
  console.log('   New email:', email);
  currentUserEmail = email;
  console.log('   ✅ Email stored successfully');
  return true;
});

// And add this to the start-native-recording handler:
ipcMain.handle('start-native-recording', async (event, sessionId) => {
  console.log('🎬 START-NATIVE-RECORDING CALLED');
  console.log('   Session ID:', sessionId);
  console.log('   Current Session ID:', currentSessionId);
  
  try {
    currentSessionId = sessionId;
    console.log('   ✅ Session ID stored');
    console.log('   🚀 Starting screenshot capture...');
    
    const outputPath = await screenshotCapture.startCapture(sessionId);
    console.log('   ✅ Screenshot capture started for session:', sessionId);
    console.log('   Output path:', outputPath);
    return { success: true, outputPath };
  } catch (error) {
    console.error('   ❌ Failed to start screenshot capture:', error);
    console.error('   Error stack:', error.stack);
    return { success: false, error: error.message };
  }
});

// And add this to the stop-native-recording handler:
ipcMain.handle('stop-native-recording', async (event) => {
  console.log('⏹️ STOP-NATIVE-RECORDING CALLED');
  console.log('   Current Session ID:', currentSessionId);
  
  try {
    const result = screenshotCapture.stopCapture();
    console.log('   ✅ Screenshot capture stopped:', result);
    console.log('   Clearing session ID...');
    currentSessionId = null;
    console.log('   ✅ Session ID cleared');
    return { success: true, ...result };
  } catch (error) {
    console.error('   ❌ Failed to stop screenshot capture:', error);
    return { success: false, error: error.message };
  }
});

console.log('📝 INSTRUCTIONS:');
console.log('   1. Replace the handlers in electron/main.cjs with the versions above');
console.log('   2. Rebuild the Electron app: npm run build-electron');
console.log('   3. Start the Electron app with DevTools open (Ctrl+Shift+I)');
console.log('   4. Watch the console for detailed logging');
console.log('   5. Log in to the app');
console.log('   6. Open HPPRO');
console.log('   7. Share the console output to identify the issue');

