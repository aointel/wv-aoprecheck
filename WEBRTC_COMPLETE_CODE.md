# Complete WebRTC Code

## Frontend: powerOnWebRTC Function
**File:** `AOIrail/client/src/components/outbound-dialer/OutboundDialerInterface.tsx`

### Main Function (Lines 652-2063)
```typescript
const powerOnWebRTC = async (identity = "producer123", agentEmail?: string, macMicrophoneStream?: MediaStream) => {
  // Full implementation from lines 652-2063
  // See file for complete code
}
```

### Key Sections:
1. **Token Fetching** (Lines 852-998)
   - Fetches from `/api/twilio/token`
   - Validates token structure
   - Checks VoiceGrant presence

2. **Device Creation** (Lines 1334-1396)
   - Windows: Uses `edge: 'roaming'`
   - Mac: Uses default edge
   - Options: `debug: true`, `enableRingingState: true`, `closeProtection: true`

3. **Registration with Retry** (Lines 1714-2020)
   - 3 retry attempts
   - 8 second timeout per attempt
   - Tries different edge regions on failure

4. **Event Handlers** (Lines 1405-1696)
   - `ready`, `registered`, `error`, `offline`, `connect`, `disconnect`, `registering`, `unregistered`, `incoming`, `cancel`

---

## Backend: Token Endpoints
**File:** `AOIrail/server/routes.ts`

### `/api/twilio/token` (Lines 8967-9018)
```typescript
app.get("/api/twilio/token", async (req, res) => {
  const userEmail = (req.session as any)?.user?.email;
  if (!userEmail || typeof userEmail !== 'string' || !userEmail.includes('@')) {
    return res.status(401).json({ error: 'Login required', message: 'You must be logged in to use WebRTC.' });
  }
  const identity = userEmail.trim().toLowerCase();

  const accountSid = TWILIO_ACCOUNT_SID;
  const apiKey = TWILIO_API_KEY;
  const apiSecret = TWILIO_API_SECRET;
  const twimlAppSid = TWILIO_TWIML_APP_SID;

  const AccessToken = twilio.jwt.AccessToken;
  const VoiceGrant = AccessToken.VoiceGrant;

  const voiceGrant = new VoiceGrant({
    outgoingApplicationSid: twimlAppSid,
    incomingAllow: true,
  });

  const token = new AccessToken(accountSid, apiKey, apiSecret, {
    identity: identity,
    ttl: 3600
  });

  token.addGrant(voiceGrant);
  const jwt = token.toJwt();

  res.json({
    token: jwt,
    identity: identity
  });
});
```

### `/api/token` (Lines 8883-8927)
- Same logic as `/api/twilio/token`
- Uses same credentials from `hardcoded-config.ts`

---

## Backend: WebRTC Voice Endpoint
**File:** `AOIrail/server/routes.ts`

### `/voice` (Lines 1008-1086)
```typescript
app.all("/voice", (req, res) => {
  const toNumber = req.body.To || req.query.To;
  const conferenceName = req.body.conference || req.query.conferenceName || req.query.conference || req.query.conferenceName;
  
  let twiml;
  
  if (toNumber) {
    // DIRECT CALL
    const leadState = req.body.leadState || req.query.leadState;
    let callerIdNumber = TWILIO_PHONE_NUMBER;
    
    if (leadState) {
      const localNumber = localPresenceService.getLocalNumber(leadState);
      if (localNumber && localNumber !== TWILIO_PHONE_NUMBER) {
        callerIdNumber = localNumber;
      }
    }
    
    const formattedToNumber = toNumber.startsWith('+') ? toNumber : `+1${toNumber.replace(/\D/g, '')}`;
    
    twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${callerIdNumber}">${formattedToNumber}</Dial>
</Response>`;
  } else if (conferenceName) {
    // CONFERENCE CALL
    const voiceRecordCb = getWebhookBaseUrl() + '/api/twilio/recording-status';
    twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Conference 
      beep="false" 
      maxParticipants="2" 
      endConferenceOnExit="true" 
      startConferenceOnEnter="true" 
      waitUrl="http://twimlets.com/holdmusic?Bucket=com.twilio.music.soft-rock"
      record="record-from-start"
      recordingStatusCallback="${voiceRecordCb}"
      recordingStatusCallbackMethod="POST">${conferenceName}</Conference>
  </Dial>
</Response>`;
  } else {
    twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Error: No call destination specified</Say>
</Response>`;
  }

  res.type('text/xml');
  res.send(twiml);
});
```

---

## Device Options (Current)
```typescript
const twilioDeviceOptions: Record<string, any> = {
  debug: true,
  enableRingingState: true,
  closeProtection: true,
  // Only set edge on Windows - let Mac use default
  ...(isWindows ? { edge: 'roaming' } : {}),
};
```

---

## Registration Retry Logic
- **Max Retries:** 3
- **Timeout per attempt:** 8000ms
- **Edge regions:** `['us1', 'us2', 'ie1', 'sg1', 'au1']`
- **Windows:** Uses `'roaming'` edge (auto-tries all regions)
- **Mac:** Uses default edge (usually `'us1'`)

---

## Key Differences from Test Page
1. **Test page:** Simple options, no `edge` specified, auto-registers
2. **Our code:** Explicit `device.register()` call, Windows-specific `edge: 'roaming'`, retry logic

---

## Files to Check
1. `AOIrail/client/src/components/outbound-dialer/OutboundDialerInterface.tsx` - Main WebRTC function
2. `AOIrail/server/routes.ts` - Token endpoints and `/voice` endpoint
3. `AOIrail/server/hardcoded-config.ts` - Twilio credentials
4. `AOIrail/client/src/pages/webrtc-test.tsx` - Working test page
