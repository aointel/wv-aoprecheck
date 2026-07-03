# Debugging Twilio Error 31005 for Leyna

## Error Details
```
ConnectionError (31005): Error sent from gateway in HANGUP
```

This means **Twilio's gateway rejected the call** during TwiML execution.

## Common Causes

### 1. Invalid Caller ID
- The `callerId` parameter in `<Dial>` must be a phone number you own in Twilio
- Check: `server/routes.ts` line 218: `<Dial callerId="${callerIdNumber}">`
- The `callerIdNumber` comes from either:
  - Local presence service (`localPresenceService.getLocalNumber(leadState)`)
  - Default: `TWILIO_PHONE_NUMBER` environment variable

**Action:** Verify `TWILIO_PHONE_NUMBER` is a valid Twilio number you own

### 2. Invalid Destination Number Format
- The phone number being dialed must be in E.164 format: `+1XXXXXXXXXX`
- Your code formats it on line 213: `const formattedToNumber = toNumber.startsWith('+') ? toNumber : \`+1${toNumber.replace(/\\D/g, '')}\`;`

**This should be fine**, but could fail if the input is completely invalid.

### 3. TwiML App Configuration Issue
- Your TwiML App SID: `AP958ebb1810e2315e9ff008cc06e91c1d`
- Voice URL should point to: `https://aoirail-production.up.railway.app/webhook/webrtc`

**Action:** Check Twilio Console → Voice → TwiML → Apps → verify the Voice URL

### 4. Identity-Specific Token Issue
- Leyna's access token might be missing the VoiceGrant or have wrong permissions
- Compare token generation for both users

## How to Debug

### Step 1: Check Twilio Console Logs
1. Go to: https://console.twilio.com/us1/monitor/logs/errors
2. Filter by time (last hour)
3. Look for calls from Leyna's identity: `leynatran@aoglobelife.com`
4. Check the error details - it will tell you EXACTLY why Twilio rejected it

### Step 2: Check Server Logs
When Leyna attempts a call, you should see:
```
📞 Formatted phone: [original] → [formatted]
🎯 Sending WebRTC TwiML: [twiml content]
```

Look for:
- Is `callerId` a valid Twilio number?
- Is `formattedToNumber` in the right format?

### Step 3: Test with cnsysop
1. Log in as `cnsysop@aoglobelife.com`
2. Make a call
3. Check the server logs for the TwiML that was sent
4. Compare with Leyna's TwiML

### Step 4: Compare Tokens
Add logging to `/api/twilio/token` endpoint (line 3775):
```javascript
console.log('🎫 Generating token for:', identity);
console.log('🔑 Using TwiML App:', newTwimlAppSid);
```

Then check if both users get the same TwiML App SID.

## Most Likely Issue

Based on your description:
- ✅ cnsysop can make calls fine
- ❌ Leyna cannot make calls (Error 31005)
- ✅ Same browser, same network

**This points to an identity-specific issue in Twilio**, NOT your code.

### Hypothesis: Twilio Account Permission
- Leyna's identity might not be authorized in your Twilio account
- Check: Twilio Console → Voice → Settings → Identity
- Or: Her token might be using a different API Key with restricted permissions

## Immediate Fix to Test

In `server/routes.ts`, add detailed logging around line 180:

```javascript
app.post("/voice", (req, res) => {
  const toNumber = req.body.To || req.query.To;
  const conferenceName = req.body.conference || req.body.conferenceName || req.query.conference || req.query.conferenceName;
  
  // ADD THIS:
  console.log('🔥 /voice called by identity:', req.body);
  console.log('📞 Caller ID will be:', TWILIO_PHONE_NUMBER);
  console.log('📞 Destination:', toNumber);
  
  // ... rest of code
});
```

Then have Leyna try to make a call and check the server logs.

## Nuclear Option: Bypass Caller ID

If nothing else works, try removing the `callerId` parameter temporarily to test:

```xml
<Dial>${formattedToNumber}</Dial>
```

Instead of:
```xml
<Dial callerId="${callerIdNumber}">${formattedToNumber}</Dial>
```

If this works, then you know the `callerId` is the problem.

