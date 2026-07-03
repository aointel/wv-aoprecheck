# Hardcoded URL Problem - Complete Fix

## The Issue

Your app has **167 hardcoded references** to `aointelligence.replit.app` in:
- Server routes (Twilio webhooks, TwiML URLs)
- Client components (WebSocket connections, verification URLs)
- Email templates

## The Solution

We need to use **dynamic URLs** based on where the app is deployed.

## Quick Fix Strategy

### 1. Create a Helper Function

Add to `server/hardcoded-config.ts`:

```typescript
// Get the base URL for the current environment
export function getBaseUrl(req?: any): string {
  // Priority 1: Explicit environment variable
  if (process.env.APP_URL) {
    return process.env.APP_URL;
  }
  
  // Priority 2: Railway auto-generated domain
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  }
  
  // Priority 3: From request headers (works anywhere)
  if (req) {
    const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    if (host) {
      return `${protocol}://${host}`;
    }
  }
  
  // Priority 4: Fallback to Replit (current production)
  return 'https://aointelligence.replit.app';
}
```

### 2. Update Server Routes

Find and replace in `server/routes.ts`:

**Before:**
```typescript
voiceUrl: 'https://aointelligence.replit.app/webhook/webrtc'
```

**After:**
```typescript
voiceUrl: `${getBaseUrl(req)}/webhook/webrtc`
```

### 3. Update Client Components

Add to client env/config:

```typescript
// client/src/config.ts
export const API_BASE_URL = import.meta.env.VITE_API_URL || window.location.origin;
```

Then use:
```typescript
const wsUrl = `${API_BASE_URL.replace('http', 'ws')}/ws`;
```

## Automated Fix Script

I'll create a script to fix all 167 instances:


