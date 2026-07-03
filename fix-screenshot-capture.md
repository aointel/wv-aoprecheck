# Screenshot Capture Not Working - Troubleshooting Guide

## Quick Fix (Try This First!)

The most common issue is that the user email isn't set or a session is stuck. Here's how to fix it:

### Fix #1: Ensure Correct Login Sequence
1. **Close the Electron app COMPLETELY** (all windows)
2. **Restart the app**
3. **Log in to your account FIRST** (wait for login to complete)
4. **Then open HPPRO** (the presentation window)

The screenshot capture MUST have your email set BEFORE HPPRO opens. If you open HPPRO before logging in, it won't work.

### Fix #2: Clear Stuck Session
If you see "Session already active" in the logs:
1. Close ALL windows in the Electron app
2. Completely quit the app (not just close windows)
3. Restart and log in
4. Then open HPPRO

### Fix #3: Rebuild Electron App (If code was updated)
```bash
npm run build-electron
```

Then restart the app.

---

## How to Debug with Console Logs

1. **Open Electron DevTools**
   - Press `Ctrl+Shift+I` (Windows) or `Cmd+Option+I` (Mac)
   - Keep the Console tab open

2. **Log in to the app**
   - Look for: `✅ Sent REAL user email to Electron main process: [your-email]`
   - If you DON'T see this, the ElectronAutoCapture component isn't running
   
3. **Open HPPRO**
   - Look for these logs in sequence:
   
   ```
   🔍 NEW WINDOW CREATED:
      Title: [some title]
      URL: [some url]
      Is Presentation? true
   
   🎯 PRESENTATION WINDOW DETECTED!
   
   🔍 CHECKING AUTO-START CONDITIONS:
      currentSessionId: null
      currentUserEmail: [your-email]
      !currentSessionId: true
      Has user email: true
   
   ✅ CONDITIONS MET - STARTING AUTO-CAPTURE
   
   🚀 AUTO-STARTING screenshot capture for session: session_xxx
   
   ✅ Backend session created: session_xxx
   
   ✅ Screenshot capture started automatically: [path]
   
   📸 Screenshot X: screenshot-0001.png (XXX KB)
   ```

4. **Identify the Problem**

   **If you see:** `❌ Reason: No user email set`
   - **Problem:** User email wasn't sent to Electron
   - **Fix:** Make sure you log in BEFORE opening HPPRO
   - **Check:** ElectronAutoCapture component should be mounted (check React DevTools)
   
   **If you see:** `⚠️ Reason: Session already active`
   - **Problem:** Previous session wasn't cleaned up
   - **Fix:** Close and restart the app
   
   **If you see:** `⚠️ HPPRO window not found. Available windows:`
   - **Problem:** Presentation window detected, but screenshot can't find it
   - **Reason:** Window title changed or doesn't match expected patterns
   - **Fix:** Check the "Available windows" list and update the patterns in `electron/screenshotCapture.cjs`
   
   **If you see:** `❌ Not a presentation window`
   - **Problem:** Window title/URL doesn't match presentation patterns
   - **Fix:** Check what title/URL HPPRO actually has and update detection patterns in `electron/main.cjs`

---

## Common Issues and Solutions

### Issue: "No user email set"
**Cause:** ElectronAutoCapture component didn't send email to Electron main process

**Solutions:**
1. Make sure you're logged in before opening HPPRO
2. Check if ElectronAutoCapture component is mounted (should see logs in browser console)
3. Check if `authState.user.email` is populated
4. Try logging out and back in

### Issue: "Session already active"
**Cause:** Previous session wasn't properly cleaned up

**Solutions:**
1. Close and restart the app completely
2. Check for stuck screenshot capture process

### Issue: Screenshots work but don't upload
**Cause:** Network error or server endpoint down

**Solutions:**
1. Check internet connection
2. Check if server is running (https://aoirail-production.up.railway.app)
3. Look for upload errors in console

### Issue: Window detected but screenshots are empty
**Cause:** Screen capture permission denied or window not found

**Solutions:**
1. Run Electron app as Administrator (Windows)
2. Check Windows Privacy Settings → Screen recording permission
3. Make sure HPPRO window is actually open and visible

---

## Code Changes Made

I've added enhanced debug logging to help identify the issue:

1. **electron/main.cjs:**
   - Added detailed logging for window creation
   - Added condition checking for auto-start
   - Added clear error messages with fix suggestions

2. **Logs to look for:**
   - `📧 SET-USER-EMAIL CALLED` - confirms email is being set
   - `🔍 CHECKING AUTO-START CONDITIONS` - shows why auto-start is or isn't working
   - `✅ CONDITIONS MET` or `❌ CONDITIONS NOT MET` - clear indicator

---

## Next Steps

1. **Rebuild the Electron app** (if you just updated the code):
   ```bash
   npm run build-electron
   ```

2. **Test with DevTools open:**
   - Open DevTools (`Ctrl+Shift+I`)
   - Log in
   - Open HPPRO
   - Watch the console

3. **Share the console output** if it's still not working
   - Copy all the logs related to screenshot capture
   - Look for the specific error message
   - Follow the "Fix" suggestions in the logs

---

## Emergency Reset

If nothing works, try this complete reset:

```bash
# 1. Close Electron app completely
# 2. Clear any cached builds
npm run clean  # if you have this script

# 3. Rebuild everything
npm install
npm run build
npm run build-electron

# 4. Start fresh
# 5. Open DevTools FIRST
# 6. Log in
# 7. Then open HPPRO
```

---

## Additional Information

### Where Screenshots Are Saved
- Local: `recordings/screenshots/[sessionId]/`
- Server: Uploaded to Live Call Board via API

### Expected Screenshot Interval
- Every 30 seconds automatically

### Expected Window Patterns
The system looks for windows with:
- Title includes: "Presentation", "Present", "AOI Presentation"
- URL includes: "hppro.planetaltig.com", "present", "deck", "slide"

If HPPRO changed its window title or URL, you'll need to update the patterns.

