# WebRTC Separate Endpoints: Electron vs Browser

## Overview

We now have **separate endpoints** for Electron and Browser to handle Twilio/WebRTC differently:

- **Browser:** `/api/twilio/token` - For Chrome, Firefox, Safari
- **Electron:** `/api/electron/twilio/token` - For AOI Desktop App

## Why Separate Endpoints?

1. **Different Cookie Handling:**
   - Electron requires `SameSite=None; Secure` (cross-origin context)
   - Browser can use `SameSite='lax'` in dev, `'none'` in prod

2. **Clear Separation:**
   - Easier to debug platform-specific issues
   - Can optimize each endpoint independently
   - Server validates platform matches request

3. **Better Error Messages:**
   - Server rejects wrong platform requests with clear error
   - Client automatically uses correct endpoint

## Server Endpoints

### `/api/twilio/token` (Browser Only)

```typescript
// Browser-only endpoint
app.get("/api/twilio/token", async (req, res) => {
  await generateTwilioToken(req, res, 'browser');
});
```

**Behavior:**
- Rejects Electron requests (returns 400 error)
- Uses standard cookie handling
- SameSite='lax' in dev, 'none' in prod

### `/api/electron/twilio/token` (Electron Only)

```typescript
// Electron-only endpoint
app.get("/api/electron/twilio/token", async (req, res) => {
  await generateTwilioToken(req, res, 'electron');
});
```

**Behavior:**
- Rejects browser requests (returns 400 error)
- Forces SameSite=None; Secure cookies
- Electron-specific cookie middleware applied

## Client-Side Usage

### Utility Functions

Created `client/src/utils/webrtc-endpoints.ts`:

```typescript
// Detect if running in Electron
export function isElectron(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Check for Electron API
  if ((window as any).electronAPI) {
    return true;
  }
  
  // Check User-Agent
  const ua = navigator.userAgent || '';
  if (ua.includes('AOI-Desktop') || ua.includes('Electron')) {
    return true;
  }
  
  return false;
}

// Get the correct Twilio token endpoint
export function getTwilioTokenEndpoint(): string {
  return isElectron() 
    ? '/api/electron/twilio/token'
    : '/api/twilio/token';
}
```

### Usage in Components

**Before:**
```typescript
const res = await fetch('/api/twilio/token', {
  method: 'GET',
  credentials: 'include',
  headers: { 'Accept': 'application/json' }
});
```

**After:**
```typescript
// Import utility
const { getTwilioTokenEndpoint } = await import('../../utils/webrtc-endpoints');
const tokenEndpoint = getTwilioTokenEndpoint();

const res = await fetch(tokenEndpoint, {
  method: 'GET',
  credentials: 'include',
  headers: { 'Accept': 'application/json' }
});
```

## Updated Files

### Server
- ✅ `server/routes.ts` - Added separate endpoints and shared token generation function

### Client
- ✅ `client/src/utils/webrtc-endpoints.ts` - New utility file
- ✅ `client/src/components/outbound-dialer/OutboundDialerInterface.tsx`
- ✅ `client/src/components/outbound-dialer/RecruitOutboundDialerInterface.tsx`
- ✅ `client/src/components/global/GlobalCallModal.tsx`
- ✅ `client/src/components/verification/verification-progress.tsx`
- ✅ `client/src/components/verification/call-interface.tsx`
- ✅ `client/src/pages/webrtc-test.tsx`
- ✅ `client/public/test-webrtc-comprehensive-diagnostics.html`

## Server Validation

The server validates that the platform matches the endpoint:

```typescript
// Validate platform matches request
if (platform === 'electron' && !isElectron) {
  return res.status(400).json({ 
    error: 'This endpoint is for Electron only. Use /api/twilio/token for browser.' 
  });
}
if (platform === 'browser' && isElectron) {
  return res.status(400).json({ 
    error: 'This endpoint is for browser only. Use /api/electron/twilio/token for Electron.' 
  });
}
```

## Benefits

1. **Automatic Detection:** Client automatically uses correct endpoint
2. **Clear Errors:** Server rejects wrong platform with helpful message
3. **Better Debugging:** Logs show which platform and endpoint is used
4. **Future-Proof:** Easy to add platform-specific features later

## Testing

To test:
1. **Browser:** Open in Chrome/Firefox - should use `/api/twilio/token`
2. **Electron:** Open in AOI Desktop - should use `/api/electron/twilio/token`
3. **Wrong Platform:** Server will return 400 error with helpful message

## Notes

- All existing functionality preserved
- Backward compatible (old endpoint still works but validates platform)
- No breaking changes to existing code
- Client-side detection is automatic and transparent
