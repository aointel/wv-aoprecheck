# WebRTC Issues - Root Causes

## Based on Console Logs Analysis

### 1. **WebSocket Connection Failures** (PRIMARY ISSUE)
```
WebSocket connection to '<URL>' failed: WebSocket is closed before the connection is established.
```

**Why this happens:**
- Twilio Voice SDK uses WebSocket (WSS) to connect to signaling servers
- Device uses `edge: 'roaming'` which auto-selects edge region
- Twilio may connect to: `chunderw-gll.twilio.com`, `chunderw-vpc-gll.twilio.com`, `wss-us1.twilio.com`, or other edge regions
- **Firewall/VPN blocking WSS connections** (most common)
- **CSP might be blocking** (though we have `wss://*.twilio.com`)

**Current CSP includes:**
- ✅ `wss://*.twilio.com` (should cover all)
- ✅ `wss://chunderw-gll.twilio.com`
- ✅ `wss://chunderw-vpc-gll.twilio.com`
- ✅ `wss://chunderw.twilio.com`
- ✅ `wss://wss-us1.twilio.com`

**But Twilio uses dynamic edge selection:**
- `roaming` edge tries multiple regions: `us1`, `us2`, `ie1`, `sg1`, etc.
- Each region has different WebSocket domains
- CSP might need ALL possible edge regions

---

### 2. **Registration Timeouts** (SYMPTOM OF #1)
```
⚠️ Registration attempt #1 timed out after 8000ms
⚠️ Registration attempt #2 timed out after 8000ms
⚠️ Registration attempt #3 timed out after 8000ms
❌ Registration failed after 3 attempts
```

**Why this happens:**
- Device tries to register but WebSocket never connects
- Device stuck in "registering" state
- After 8 seconds, timeout triggers
- Retries 3 times, all fail

**Root cause:** WebSocket connection failure (see #1)

---

### 3. **AudioContext Issues** (BROWSER POLICY)
```
The AudioContext was not allowed to start. It must be resumed (or created) after a user gesture on the page.
```

**Why this happens:**
- Browser autoplay policy requires user interaction
- AudioContext created before user clicks
- Need to call `audioContext.resume()` after user gesture

**Fix needed:** Resume AudioContext after user clicks "Start Dialing"

---

### 4. **InvalidStateError** (RACE CONDITION)
```
InvalidStateError: Attempt to unregister when device is in state "registering". Must be "registered".
```

**Why this happens:**
- Cleanup code tries to unregister device
- But device is still in "registering" state (never registered)
- Can't unregister a device that's not registered

**Fix needed:** Check device state before unregistering

---

## The Real Problem

**90% of WebRTC failures are caused by:**

1. **Network/Firewall Blocking WebSockets** (User's network)
   - Corporate firewalls
   - VPNs
   - ISP restrictions
   - **Solution:** User needs to allow WSS or disable VPN

2. **Twilio Edge Region Selection** (Our code)
   - `edge: 'roaming'` tries multiple regions
   - Some regions might be blocked
   - **Solution:** Force specific edge region or add all to CSP

3. **Device Lifecycle Issues** (Our code)
   - Device not properly cleaned up
   - Multiple device instances
   - Race conditions
   - **Solution:** Better device management

---

## Immediate Fixes

1. **Add ALL Twilio edge regions to CSP**
2. **Force specific edge region** (us1) instead of roaming
3. **Better error messages** telling users about firewall/VPN
4. **Fix AudioContext** - resume after user gesture
5. **Fix device cleanup** - check state before unregistering
