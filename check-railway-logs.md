# Check Railway Logs

Run this command to see if screenshots are being received:

```bash
railway logs --tail
```

Look for these messages:
- `📸 SCREENSHOT UPLOAD RECEIVED (Live Board endpoint)` - means Electron is uploading
- `✅ Screenshot saved to database` - means server saved it
- `❌ Failed to save screenshot` - means there's an error

If you don't see ANY of these messages, then **Electron isn't uploading screenshots to the server at all**.

## Alternative: Check production URL

The Electron app is probably using the wrong URL. Check what `process.env.VITE_API_URL` is set to in production.

If it's not set, Electron defaults to `http://localhost:5000` which won't work for Leyna.

## Quick test

Have Leyna open DevTools in the Electron app (F12 or Ctrl+Shift+I) and look for:
- `📤 Uploading screenshot X to Live Board...`
- `✅ Screenshot X uploaded to Live Board successfully`
- `❌ Screenshot upload failed: [error]`

This will tell us if Electron is even trying to upload.

