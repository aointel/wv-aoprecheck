# WebRTC Code Comparison: Old vs Current

## Commit 26067cb1 (Railway Deployment - Feb 25, 2026)
This appears to be a Railway deployment commit. Based on git history, the working version was around commits:
- `c568162d` - "Add WebRTC workaround banner to /connect page with Chrome URL"
- `8eb909f7` - "Fix Electron WebRTC cookies - use User-Agent detection, force SameSite=None, add debug logging"

## Key Differences

### OLD IMPLEMENTATION (c568162d / 8eb909f7)

**Single Endpoint Approach:**
- **One endpoint:** `/api/twilio/token` handled BOTH browser and Electron
- **Platform detection:** Server detected Electron via User-Agent (`AOI-Desktop` or `Electron`)
- **Cookie handling:** Same endpoint tried to handle both platforms with conditional logic
- **Client-side:** All clients called the same endpoint `/api/twilio/token`

**Code Structure:**
```typescript
// Single endpoint for both platforms
app.get("/api/twilio/token", async (req, res) => {
  const ua = req.headers['user-agent'] || '';
  const isElectron = ua.includes('AOI-Desktop') || ua.includes('Electron');
  
  // Conditional cookie handling based on platform
  if (isElectron) {
    // Electron-specific cookie logic
  } else {
    // Browser cookie logic
  }
  
  // Generate token...
});
```

**Client-side:**
```typescript
// All clients used same endpoint
const res = await fetch('/api/twilio/token', {
  credentials: 'include',
  headers: { 'Accept': 'application/json' }
});
```

---

### CURRENT IMPLEMENTATION (After Separate Endpoints)

**Separate Endpoints Approach:**
- **Two endpoints:**
  - `/api/twilio/token` - Browser ONLY (Chrome, Firefox, Safari)
  - `/api/electron/twilio/token` - Electron ONLY (AOI Desktop App)
- **Platform validation:** Server REJECTS wrong platform (returns 400 error)
- **Clear separation:** Each endpoint has its own cookie handling logic
- **Client-side utility:** `webrtc-endpoints.ts` automatically selects correct endpoint

**Code Structure:**
```typescript
// Shared token generation function
const generateTwilioToken = async (req: any, res: any, platform: 'browser' | 'electron') => {
  const ua = req.headers['user-agent'] || '';
  const isElectron = ua.includes('AOI-Desktop') || ua.includes('Electron');
  
  // VALIDATE platform matches request
  if (platform === 'electron' && !isElectron) {
    return res.status(400).json({ error: 'This endpoint is for Electron only.' });
  }
  if (platform === 'browser' && isElectron) {
    return res.status(400).json({ error: 'This endpoint is for browser only.' });
  }
  
  // Generate token...
};

// Browser-only endpoint
app.get("/api/twilio/token", async (req, res) => {
  await generateTwilioToken(req, res, 'browser');
});

// Electron-only endpoint
app.get("/api/electron/twilio/token", async (req, res) => {
  await generateTwilioToken(req, res, 'electron');
});
```

**Client-side:**
```typescript
// New utility file: client/src/utils/webrtc-endpoints.ts
export function isElectron(): boolean {
  return (navigator.userAgent.includes('AOI-Desktop') || 
          navigator.userAgent.includes('Electron')) || 
         (window as any).electronAPI !== undefined;
}

export function getTwilioTokenEndpoint(): string {
  return isElectron() 
    ? '/api/electron/twilio/token'
    : '/api/twilio/token';
}

// Usage in components
const { getTwilioTokenEndpoint } = await import('../../utils/webrtc-endpoints');
const tokenEndpoint = getTwilioTokenEndpoint();

const res = await fetch(tokenEndpoint, {
  credentials: 'include',
  headers: { 'Accept': 'application/json' }
});
```

---

## Benefits of Current Implementation

1. **Clear Separation:**
   - Each platform has its own endpoint
   - Easier to debug platform-specific issues
   - Can optimize each endpoint independently

2. **Better Error Messages:**
   - Server explicitly rejects wrong platform requests
   - Clear error: "This endpoint is for Electron only. Use /api/twilio/token for browser."

3. **Automatic Client Detection:**
   - Client automatically uses correct endpoint
   - No manual endpoint selection needed
   - Utility function handles all detection logic

4. **Platform Validation:**
   - Server validates platform matches request
   - Prevents accidental cross-platform usage
   - Better security and debugging

---

## Files Changed

### Server
- ✅ `server/routes.ts` - Added separate endpoints and shared token generation function

### Client
- ✅ `client/src/utils/webrtc-endpoints.ts` - **NEW FILE** - Platform detection utility
- ✅ `client/src/components/outbound-dialer/OutboundDialerInterface.tsx`
- ✅ `client/src/components/outbound-dialer/RecruitOutboundDialerInterface.tsx`
- ✅ `client/src/components/global/GlobalCallModal.tsx`
- ✅ `client/src/components/verification/verification-progress.tsx`
- ✅ `client/src/components/verification/call-interface.tsx`
- ✅ `client/src/pages/webrtc-test.tsx`
- ✅ `client/public/test-webrtc-comprehensive-diagnostics.html`

---

## Summary

**OLD:** Single endpoint tried to handle both platforms with conditional logic  
**NEW:** Separate endpoints with platform validation and automatic client-side routing

The current implementation provides better separation of concerns, clearer error messages, and easier debugging for platform-specific WebRTC issues.
