# WebRTC Token Storage & Control Systems

## Overview
Multiple systems exist to store and control WebRTC tokens. Some are still active, some are disabled but still imported.

---

## 1. **token-session-store.ts** (PARTIALLY DISABLED)
**Location:** `server/token-session-store.ts`
**Status:** ⚠️ **Still imported but checks removed from endpoints**

### Functions:
- `hasActiveToken(identity)` - Checks if user has active token (1 hour TTL)
- `setTokenIssued(identity)` - Records when token was issued
- `releaseTokenSlot(identity)` - Clears token slot (called on logout/tab close)

### Storage:
- In-memory `Map<string, number>` - `lastTokenIssuedAtByUser`
- TTL: 3600 seconds (1 hour)

### Current Status:
- ✅ **Checks REMOVED** from `/api/token` and `/api/twilio/token` endpoints
- ⚠️ **Still imported** in `routes.ts` (line 70)
- ⚠️ **Still used** by `/api/twilio/release-token` endpoint (line 8873)

### Recommendation:
- Remove import if not needed
- Or keep for `release-token` endpoint if you want to track token releases

---

## 2. **webrtc-token-store.ts** (UNUSED)
**Location:** `server/webrtc-token-store.ts`
**Status:** ❌ **Not imported anywhere - dead code**

### Functions:
- `canIssueToken(identity)` - Checks if token can be issued (opposite logic of hasActiveToken)
- `recordTokenIssued(identity)` - Records token issuance
- `clearTokenForLogout(email)` - Clears token on logout

### Storage:
- In-memory `Map<string, number>` - `lastTokenIssuedAtByUser`
- TTL: 3600 seconds (1 hour)

### Current Status:
- ❌ **Not imported** - dead code
- ❌ **Not used** by any endpoints

### Recommendation:
- **DELETE** this file - it's unused duplicate code

---

## 3. **Token Endpoints** (ACTIVE)

### `/api/token` (GET)
**Location:** `server/routes.ts` (line 8883)
**Status:** ✅ **Active - token restriction REMOVED**
- Uses hardcoded Twilio credentials
- No token tracking (restriction removed)
- Returns JWT token

### `/api/twilio/token` (GET)
**Location:** `server/routes.ts` (line 8968)
**Status:** ✅ **Active - token restriction REMOVED**
- Uses `TWILIO_ACCOUNT_SID`, `TWILIO_API_KEY`, `TWILIO_API_SECRET` from config
- No token tracking (restriction removed)
- Returns JWT token with identity

### `/api/twilio/webrtc-token` (POST)
**Location:** `server/vdp-service-fixed.ts` (line 497)
**Status:** ✅ **Active - NO token restrictions**
- Uses hardcoded credentials from `hardcoded-config.ts`
- No token tracking/restrictions
- Returns token with identity

### `/api/twilio/release-token` (POST)
**Location:** `server/routes.ts` (line 8867)
**Status:** ✅ **Active - uses token-session-store**
- Calls `releaseTokenSlot(userEmail)` to clear token slot
- Used when user closes tab/navigates away

---

## 4. **Frontend Token Requests**

### Primary Endpoint Used:
- **`/api/twilio/token`** (GET) - Used by `OutboundDialerInterface.tsx` (line 877)
- **`/api/token`** (GET) - Used by `OutboundDialerInterface.tsx` (line 6712) for simple calls

### Headers Sent:
- `x-user-email` header (if available)
- Session cookies (`credentials: 'include'`)

---

## 5. **Other Token Systems** (NOT WebRTC)

### `token-store.ts` (Google Calendar)
**Location:** `server/token-store.ts`
**Status:** ✅ **Active - for Google Calendar OAuth tokens**
- Different system - not related to WebRTC
- Stores Google OAuth tokens in Supabase

---

## Summary

### Active Token Control Systems:
1. ✅ **token-session-store.ts** - Still imported, used by `release-token` endpoint
2. ✅ **Multiple token endpoints** - All active, restrictions removed from main endpoints

### Dead Code:
1. ❌ **webrtc-token-store.ts** - Not imported, should be deleted

### Recommendations:
1. **Remove unused import** - `hasActiveToken` and `setTokenIssued` from `routes.ts` if not needed
2. **Delete dead code** - Remove `webrtc-token-store.ts` file
3. **Keep release-token** - If you want to track token releases, keep `releaseTokenSlot` function
4. **Consider cleanup** - Remove `token-session-store.ts` entirely if you don't need token release tracking

---

## Current Token Flow:
1. User requests token from `/api/twilio/token` or `/api/token`
2. ✅ **No restrictions** - token issued immediately
3. Token valid for 1 hour (Twilio TTL)
4. User can request multiple tokens (no blocking)
5. Optional: User calls `/api/twilio/release-token` to clear slot (if tracking enabled)
