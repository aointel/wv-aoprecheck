# WebRTC: Electron vs Chrome Browser - Complete Working Code (4 Days Ago)

**Commit:** `8eb909f7` - Fix Electron WebRTC cookies - use User-Agent detection, force SameSite=None, add debug logging  
**Date:** Wed Feb 25 09:24:55 2026

## Key Differences: Electron vs Chrome Browser

### 1. Cookie Handling

#### **Electron:**
- **SameSite:** Must be `'none'` (cross-origin context)
- **Secure:** Must be `true` in production (HTTPS required)
- **Detection:** Via User-Agent: `'AOI-Desktop'` or `'Electron'`
- **Why:** Electron runs in a cross-origin context, cookies need SameSite=None

#### **Chrome Browser:**
- **SameSite:** Can be `'lax'` in development, `'none'` in production (for subdomains)
- **Secure:** `true` in production, `false` in development
- **Detection:** Standard browser User-Agent (no Electron markers)
- **Why:** Same-origin requests, standard cookie behavior

---

## Complete Working Server Code (from commit 8eb909f7)

### `server/index.ts` - Session & Cookie Configuration

```typescript
// Helper to detect Electron requests via User-Agent (works immediately, no Electron changes needed)
function isElectronRequest(req: any): boolean {
  const ua = req.headers['user-agent'] || '';
  return ua.includes('AOI-Desktop') || ua.includes('Electron');
}

// Session middleware for authentication
// CRITICAL: Use 'none' for production (subdomains) and Electron (cross-origin)
// Electron detection happens per-request in middleware below
app.use(session({
  store: sessionStore ?? undefined,
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: NODE_ENV === 'production', // Must be true in production for HTTPS (required for SameSite=None)
    httpOnly: true, // Prevent XSS attacks
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    // Use 'none' in production for subdomains, 'lax' in dev for browsers
    // Electron will be forced to 'none' via middleware below
    sameSite: NODE_ENV === 'production' ? 'none' : 'lax'
  }
}));

// CRITICAL: Force Electron cookies to use SameSite=None; Secure
// This middleware runs AFTER session middleware to override cookie settings
app.use((req, res, next) => {
  const isElectron = isElectronRequest(req);
  
  if (isElectron) {
    // Override res.cookie to force SameSite=None; Secure for ALL cookies in Electron
    const originalCookie = res.cookie.bind(res);
    res.cookie = function(name: string, value: string, options: any = {}) {
      const electronOptions = {
        ...options,
        sameSite: 'none' as const,
        secure: NODE_ENV === 'production', // HTTPS required for SameSite=None
        httpOnly: options.httpOnly !== false, // Preserve httpOnly unless explicitly disabled
      };
      return originalCookie(name, value, electronOptions);
    };
    
    // Also override session cookie if it exists
    if ((req.session as any)?.cookie) {
      (req.session as any).cookie.sameSite = 'none';
      (req.session as any).cookie.secure = NODE_ENV === 'production';
    }
  }
  
  next();
});
```

### `server/routes.ts` - WebRTC Token Endpoint

```typescript
// Legacy token endpoint to return proper JWT for WebRTC (returns JSON format)
// User MUST be logged in to use WebRTC - identity from SESSION ONLY (never trust query/body)
app.get("/api/twilio/token", async (req, res) => {
  try {
    // CRITICAL: Debug logging for Electron cookie issues
    const ua = req.headers['user-agent'] || '';
    const isElectron = ua.includes('AOI-Desktop') || ua.includes('Electron');
    console.log("🔍 [TOKEN DEBUG]", {
      ua: ua.substring(0, 100),
      desktop: req.headers['x-desktop-app'],
      isElectron,
      cookie: req.headers.cookie ? req.headers.cookie.substring(0, 200) : 'NO COOKIES',
      sessionID: (req as any).sessionID,
      sessionUser: (req.session as any)?.user?.email || 'NO SESSION USER',
      origin: req.headers.origin,
    });
    
    const userEmail = (req.session as any)?.user?.email;
    if (!userEmail || typeof userEmail !== 'string' || !userEmail.includes('@')) {
      console.error("❌ [TOKEN DEBUG] No session user - cookies not working for Electron");
      return res.status(401).json({ error: 'Login required', message: 'You must be logged in to use WebRTC.' });
    }
    const identity = userEmail.trim().toLowerCase();

    const accountSid = TWILIO_ACCOUNT_SID;
    const apiKey = TWILIO_API_KEY;
    const apiSecret = TWILIO_API_SECRET;
    const twimlAppSid = TWILIO_TWIML_APP_SID;
    
    if (!accountSid || !apiKey || !apiSecret || !twimlAppSid) {
      return res.status(500).json({ error: 'Missing Twilio credentials' });
    }

    // Use TwiML App SID from config (already correct)
    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: twimlAppSid, // Use from config, not hardcoded
      incomingAllow: true,
    });

    const token = new AccessToken(accountSid, apiKey, apiSecret, {
      identity: identity,
      ttl: 3600
    });

    token.addGrant(voiceGrant);

    const jwt = token.toJwt();
    console.log(`✅ Generated token for identity: ${identity}`);
    console.log(`Token length: ${jwt.length} characters`);
    console.log(`TwiML App SID: ${twimlAppSid}`);
    console.log(`AccountSid: ${accountSid?.substring(0, 10)}...`);
    console.log(`ApiKey: ${apiKey?.substring(0, 10)}...`);

    res.json({
      token: jwt,
      identity: identity
    });

  } catch (error) {
    console.error('Token generation failed:', error);
    res.status(500).json({ error: 'Failed to generate token' });
  }
});
```

### `server/auth-service.ts` - Login Cookie Handling

```typescript
// Set shared auth cookie for compartmentalized architecture
const accessToken = data.session?.access_token;
if (accessToken) {
  const isProduction = process.env.NODE_ENV === 'production';
  const cookieDomain = process.env.AUTH_COOKIE_DOMAIN; // e.g. .aoiglobe.com for all subdomains
  
  // CRITICAL: Detect Electron via User-Agent (works immediately, no Electron changes needed)
  const ua = req.headers['user-agent'] || '';
  const isElectron = ua.includes('AOI-Desktop') || ua.includes('Electron');
  
  // Electron requires 'none' for cross-origin, production also needs 'none' for subdomains
  const sameSiteValue = isElectron || isProduction ? 'none' : 'lax';
  
  res.cookie('sb-access-token', accessToken, {
    httpOnly: true,
    secure: isProduction, // HTTPS required for 'none' sameSite
    sameSite: sameSiteValue,
    maxAge: 24 * 60 * 60 * 1000,
    ...(cookieDomain ? { domain: cookieDomain } : {}),
  });
}
```

---

## Client-Side Code: Electron vs Browser

### **BOTH Electron and Browser Use Same Code:**

```typescript
// Client-side fetch (works for both Electron and Chrome)
const res = await fetch('/api/twilio/token', {
  method: 'GET',
  credentials: 'include', // CRITICAL: Always send cookies
  headers: { 'Accept': 'application/json' }
});

if (!res.ok) {
  const err = await res.json().catch(() => ({}));
  throw new Error(err?.message || err?.error || "Login required to get token");
}

const tokenData = await res.json();
const token = tokenData.token;
```

**Key Point:** The client code is identical. The difference is handled entirely on the server side based on User-Agent detection.

---

## How It Works

### **Electron Flow:**
1. Electron app makes request with User-Agent: `'AOI-Desktop'` or `'Electron'`
2. Server detects Electron via `isElectronRequest()`
3. Server middleware forces `SameSite=None; Secure` for all cookies
4. Session cookie is set with Electron-compatible settings
5. WebRTC token request includes cookies (via `credentials: 'include'`)
6. Server reads session from cookies and generates token

### **Chrome Browser Flow:**
1. Browser makes request with standard User-Agent
2. Server uses default session cookie settings (`'lax'` in dev, `'none'` in prod)
3. Session cookie is set with browser-compatible settings
4. WebRTC token request includes cookies (via `credentials: 'include'`)
5. Server reads session from cookies and generates token

---

## Critical Differences Summary

| Aspect | Electron | Chrome Browser |
|--------|----------|----------------|
| **User-Agent Detection** | `'AOI-Desktop'` or `'Electron'` | Standard browser UA |
| **SameSite Cookie** | Always `'none'` | `'lax'` (dev) or `'none'` (prod) |
| **Secure Cookie** | Always `true` in production | `true` (prod) or `false` (dev) |
| **Cookie Override** | Middleware forces `SameSite=None` | Uses default session config |
| **Client Code** | Identical to browser | Identical to Electron |
| **Why Different** | Cross-origin context | Same-origin context |

---

## Debug Endpoint

```typescript
// Debug route to check session state in Electron
app.get("/api/debug/whoami", (req: any, res: any) => {
  const ua = req.headers['user-agent'] || '';
  const isElectron = ua.includes('AOI-Desktop') || ua.includes('Electron');
  res.json({
    sessionID: (req as any).sessionID,
    sessionUser: (req.session as any)?.user,
    cookieHeader: req.headers.cookie ? req.headers.cookie.substring(0, 500) : 'NO COOKIES',
    origin: req.headers.origin,
    ua: ua.substring(0, 200),
    isElectron,
  });
});
```

---

## Notes

1. **No Client Changes Needed:** The separation is handled entirely server-side via User-Agent detection
2. **Automatic Detection:** Electron is detected immediately via User-Agent, no Electron app changes required
3. **Cookie Middleware:** Runs AFTER session middleware to override cookie settings for Electron
4. **Production vs Development:** Both Electron and browser need `Secure=true` in production for `SameSite=None`
5. **Session-Based Auth:** Both use session cookies, but with different `SameSite` values based on platform

---

## Testing

To test Electron vs Browser:
1. **Electron:** Check User-Agent contains `'AOI-Desktop'` or `'Electron'`
2. **Browser:** Check User-Agent is standard browser (Chrome, Firefox, etc.)
3. **Debug Endpoint:** Use `/api/debug/whoami` to verify session state
4. **Token Endpoint:** Check `/api/twilio/token` logs for `isElectron` flag

---

**Last Updated:** Based on commit `8eb909f7` from Feb 25, 2026
