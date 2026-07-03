# Screenshot Capture Server-Side Fixes

## Issues Found and Fixed

### Bug #1: Wrong Session ID field in screenshot count query
**Location:** `server/presentation-tracker.ts` line 132

**Problem:**
```typescript
// WRONG - querying by string session_id
.eq('session_id', sessionId);  // sessionId = 'session_12345_abc'

// But inserting with UUID
session_id: session.id  // session.id = UUID
```

The code was querying screenshots using the string `session_id` but inserting them with the UUID `id`. This meant the screenshot count was always wrong (always returning 0), which could cause sequence number issues.

**Fix:**
```typescript
.eq('session_id', session.id); // Use UUID consistently
```

---

### Bug #2: `fileName` variable scope issue
**Location:** `server/presentation-tracker.ts` line 180

**Problem:**
```typescript
try {
  // ...
  const fileName = `PRES-${sessionId}-${Date.now()}.jpg`; // ← Inside try block
  // ...
} catch (error) {
  console.error(error);
}

// Later, OUTSIDE the try block:
.insert({
  file_path: fileName  // ← fileName may be undefined!
})
```

If the upload failed or threw an exception before `fileName` was defined, the insert would fail with "fileName is not defined".

**Fix:**
```typescript
let fileName = `PRES-${sessionId}-${Date.now()}.jpg`; // Define OUTSIDE try block
try {
  // ... upload code
}
```

---

### Enhancement #3: Added comprehensive logging
**Locations:** 
- `server/routes.ts` line ~7986 (`/api/live-call-board/presentations/screenshot`)
- `server/routes.ts` line ~29277 (`/api/presentations/screenshot`)
- `server/presentation-tracker.ts` line 193 (upload error details)

**Added:**
- Log when screenshots are received
- Log screenshot size
- Log if session ID or data is missing
- Log detailed error messages
- Log each step of the process

This will help you see:
- ✅ If screenshots are reaching the server
- ✅ If they're being saved to the database
- ✅ If Supabase storage upload is failing
- ✅ Exact error messages if something fails

---

## How to Deploy the Fix

### Option 1: Deploy to Railway (Production)
```bash
npm run build:production
npm run deploy:production
```

### Option 2: Test locally first
```bash
npm run dev
```

Then check the server logs when a screenshot is uploaded.

---

## How to Test

1. **Start the Electron app** (or use the web app with presentation tracking)

2. **Open HPPRO** in the app

3. **Watch the server logs** for these messages:

   ```
   📸 SCREENSHOT UPLOAD RECEIVED (Live Board endpoint)
      Session ID: session_12345_abc
      Screenshot size: 123456 bytes
   
   ✅ Live tracker updated
   
   ✅ Screenshot uploaded with signed URL
   
   📸 Screenshot 1 captured for session session_12345_abc
   
   ✅ Screenshot saved to database for session session_12345_abc
   ```

4. **If you see errors**, they'll now be more detailed:

   ```
   ❌ No session ID provided
   ❌ No screenshot data provided
   ❌ Presentation not found in live tracker: session_xyz
   ❌ Screenshot upload error: [detailed error message]
   ❌ Failed to save screenshot: [detailed error with stack trace]
   ```

---

## What Was NOT Changed

- **Electron app code** - No changes needed (it's working correctly)
- **Frontend code** - No changes needed
- **Database schema** - No changes needed

The bug was purely server-side in how screenshots were being saved.

---

## Expected Behavior After Fix

1. **Electron captures screenshot every 30 seconds** ✅
2. **Uploads to server via POST** ✅
3. **Server saves to Supabase Storage** ✅ (should work now)
4. **Server inserts record to database** ✅ (should work now)
5. **Screenshot appears in Live Call Board** ✅
6. **AI analysis runs on screenshot** ✅

---

## Still Not Working?

Check server logs for:

1. **"❌ Screenshot upload error"** → Supabase storage permissions issue
2. **"❌ Session not found in database"** → Session wasn't created properly
3. **"❌ Presentation not found in live tracker"** → Session not in memory (server restarted?)
4. **Nothing in logs at all** → Screenshots not reaching the server (check Electron upload logic)

Run this to see if screenshots are even being uploaded:
```bash
# Watch server logs in real-time
railway logs
```

Or if running locally:
```bash
npm run dev | grep "SCREENSHOT"
```

This will filter for only screenshot-related logs.

