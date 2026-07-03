# Leyna's WebRTC Issue - Diagnostic

## What Works for Other Agents:
- WebRTC device initialization ✅
- Twilio token generation ✅
- Device registration ✅
- Making calls ✅

## What Fails for Leyna ONLY:
```
✅ Associate ID: 117239 States: 38
📞 Making DIRECT call to lead: Gerald Parent (2074809037)
✅ Agent WebRTC connected for DIRECT call
Received an error from the gateway:
❌ WebRTC connection error:
```

## Possible Causes:

### 1. **Twilio Account Issue**
- Her associate_id (117239) might not be authorized in Twilio
- Check: Twilio Dashboard > Voice > Authorized Agents

### 2. **Token Identity Issue**
- Token is generated with identity: `leynatran@aoglobelife.com`
- Maybe Twilio has a whitelist/blacklist?

### 3. **State Licensing Issue**
- She has 38 states but calling Maine (207)
- Maybe Maine is NOT in her 38 states?
- Lead state: Unknown (not passed correctly?)

### 4. **Recent Permission Change**
- She was JUST added as Super Admin
- Maybe her account is in a transition state?

## Next Steps:

1. **Check Twilio Dashboard Logs**
   - Go to: https://console.twilio.com/monitor/logs/calls
   - Filter by: last hour
   - Look for calls from: leynatran@aoglobelife.com

2. **Test with Different Lead**
   - Try calling a lead in a different state
   - Try calling a test number

3. **Check Associate ID**
   - Query database: `SELECT * FROM producers WHERE associate_id = 117239`
   - Verify states list

4. **Compare with Working Agent**
   - Check another agent's token vs Leyna's
   - Compare associate_id configuration

## Hypothesis:
**The "gateway error" is likely Twilio rejecting the call based on:**
- Missing/invalid state information for the lead
- Associate ID not configured in Twilio
- Account-level restriction we can't see from logs

