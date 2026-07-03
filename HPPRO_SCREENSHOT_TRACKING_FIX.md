# HPPro Screenshot Tracking Fix

## Problem
HPPro presentation screenshots were being captured locally but NOT sent to the Live Board server, so the "View Current Slide" button had no screenshots to display.

## Solution Implemented

### Changes Made to `electron/screenshotCapture.cjs`

**1. Added Screenshot Upload Functionality**
- Added `uploadScreenshotToServer()` method to upload each captured screenshot
- Uses Electron's `net` module for HTTP requests (works in Electron main process)
- Converts PNG buffer to base64 data URL for transmission

**2. Automatic Upload on Capture**
```javascript
// Upload screenshot to server for Live Board
if (this.sessionId) {
  this.uploadScreenshotToServer(filepath, screenshot).catch(err => {
    console.error('❌ Failed to upload screenshot to server:', err);
  });
}
```

**3. Server Endpoint Integration**
- Uploads to: `/api/live-call-board/presentations/screenshot`
- Payload: `{ sessionId, screenshotUrl }`
- Server updates the `presentationLiveTracker` with the latest screenshot

## How It Works Now

### Flow:
1. **Agent opens HPPro presentation**
   - Electron detects presentation window
   - Starts screenshot capture (every 30 seconds)
   - Presentation session created with sessionId

2. **Screenshot Capture**
   - Every 30 seconds, captures HPPro window
   - Saves locally to `recordings/screenshots/{sessionId}/`
   - **Immediately uploads to server** via HTTP POST

3. **Server Updates**
   - Server receives screenshot as base64 data URL
   - Updates `presentationLiveTracker` with latest screenshot
   - Sets `latestScreenshot` field on presentation object

4. **Live Board Display**
   - Live Board polls `/api/live-call-board/presentations` every 10 seconds
   - Receives presentations with `latestScreenshot` field populated
   - "View Current Slide" button appears when screenshot available
   - Clicking button opens modal with current screenshot

## Testing

### To Verify It Works:

1. **Open Electron App (Desktop Version)**
2. **Start HPPro presentation** (https://hppro.planetaltig.com)
3. **Check Electron Console** for logs:
   ```
   📸 Screenshot 1: screenshot-0001.png (245.3 KB)
   📤 Uploading screenshot 1 to Live Board for session ABC123...
   ✅ Screenshot 1 uploaded to Live Board successfully
   ```

4. **Open Live Board** (in browser or separate window)
5. **Look for Active Presentations section**
6. **Verify:**
   - Presentation appears in list
   - "View Current Slide" button appears (not "Waiting for screenshot...")
   - Clicking button opens modal with screenshot

### Console Logs to Watch:

**Electron (Main Process):**
```
✅ Capturing HPPRO window: HPPro - Planet ALTIG
📸 Screenshot 1: screenshot-0001.png (245.3 KB)
📤 Uploading screenshot 1 to Live Board for session 12345...
✅ Screenshot 1 uploaded to Live Board successfully
```

**Server:**
```
📸 Presentation Tracker: Updated screenshot for 12345 (count: 1)
✅ Presentation 12345 confirmed LIVE after 2 screenshots
```

**Browser (Live Board):**
```
🖼️ Opening screenshot modal: data:image/png;base64,iVBORw0KGgoAAAA...
✅ Screenshot loaded successfully
```

## Configuration

### Server URL
The electron app uses the following priority for server URL:
1. `process.env.VITE_API_URL` (if set in environment)
2. `http://localhost:5000` (default for development)

For production builds, ensure `VITE_API_URL` is set to your production server.

## Troubleshooting

### Screenshot Not Appearing on Live Board

**Check 1: Is screenshot being captured?**
- Look for "📸 Screenshot X: ..." in Electron console
- If not, HPPro window may not be detected

**Check 2: Is upload succeeding?**
- Look for "✅ Screenshot X uploaded to Live Board successfully"
- If seeing "❌ Screenshot upload failed", check server URL

**Check 3: Is presentation tracked?**
- Presentation must be "confirmed LIVE" (after 30s or 2 screenshots)
- Check server logs for "✅ Presentation X confirmed LIVE"

**Check 4: Is Live Board fetching data?**
- Live Board should poll every 10 seconds
- Check Network tab for `/api/live-call-board/presentations` requests
- Verify response includes `latestScreenshot` field

### Common Issues

1. **"Waiting for screenshot..." shows forever**
   - Presentation not confirmed LIVE yet (needs 30s)
   - Screenshots not being uploaded (check Electron console)
   - Server not receiving screenshots (check server logs)

2. **Button click does nothing**
   - `latestScreenshot` is null or undefined
   - Check browser console for click handler logs

3. **Modal opens but shows error**
   - Screenshot data URL is invalid
   - Base64 encoding issue
   - Check screenshot URL format in response

## Files Modified

- `electron/screenshotCapture.cjs` - Added upload functionality
- `client/src/pages/LiveCallBoardNew.tsx` - Enhanced button and modal
- `server/presentation-live-tracker.ts` - (No changes needed, already has updateScreenshot)
- `server/routes.ts` - (No changes needed, endpoint already exists)

## Next Steps

If screenshots still don't appear after these changes:
1. Restart Electron app (to load new code)
2. Check Electron DevTools console (View > Toggle Developer Tools)
3. Check server logs for upload receipts
4. Verify presentation session ID matches in Electron and server logs

