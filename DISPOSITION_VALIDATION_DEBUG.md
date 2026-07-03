# Disposition Validation Debug Guide

## What Was Changed

Added validation to require answered calls for certain dispositions. Here's what the validation does:

### Dispositions That REQUIRE Answered Call:
- `booked`
- `sale`
- `not_interested`
- `callback` / `call_back`
- `already_been_sold`
- `over_age`
- `medically_uninsurable`
- `duplicate`
- `instant_presentation`

### Dispositions That DON'T Require Answered Call:
- `no_answer`
- `no_answer_vm`
- `wrong_number` (auto-marked by Twilio)
- `dnc` (do not call)

## How Validation Works

1. **Checks if disposition requires answer** - If yes, continues validation
2. **Queries `twilio_call_logs`** for:
   - Agent email matches
   - Phone number matches (tries multiple formats)
   - Call status is `answered` or `completed`
   - Call was made within last hour
3. **If no answered call found:**
   - Checks if call failed with bad number flag
   - If bad number: Blocks and suggests `wrong_number`
   - If not bad number: Blocks and suggests `no_answer`, `no_answer_vm`, `wrong_number`, or `dnc`
4. **If answered call found:** Allows the disposition

## Potential Issues

### Issue 1: Phone Number Matching
The validation tries multiple phone formats:
- Original format
- `+1` + digits only
- `+` + digits only  
- Digits only

**Problem:** If phone in `twilio_call_logs` is stored differently than `leadPhone`, it won't match.

**Fix:** Check how phones are stored in `twilio_call_logs.to_number` vs how they're passed in `leadPhone`.

### Issue 2: Time Window Too Short
Validation only checks calls from last hour. If agent called 2 hours ago, it won't find it.

**Fix:** Increase time window or use the 24-hour check from the frontend.

### Issue 3: Database Query Errors
If the Supabase query fails, it now blocks the disposition (changed from allowing it through).

**Fix:** Check server logs for database errors.

### Issue 4: Missing `is_bad_number` Column
The validation checks for `is_bad_number` column which might not exist yet.

**Fix:** Make sure `twilio-status-webhook.ts` is creating this column, or make the check optional.

## How to Debug

1. **Check server logs** when disposition is saved:
   ```
   💾 Saving call disposition for lead...
   ✅ Call was answered - allowing disposition...
   ```
   OR
   ```
   ❌ Error validating call answer status: ...
   ```

2. **Check if phone numbers match:**
   ```sql
   SELECT to_number, owner_email, call_status, call_started_at 
   FROM twilio_call_logs 
   WHERE owner_email = 'agent@email.com' 
   AND to_number LIKE '%5551234567%'
   ORDER BY call_started_at DESC;
   ```

3. **Test with a known good call:**
   - Make a call that you know was answered
   - Try to set `booked` disposition
   - Check if it works or fails

4. **Check if validation is even running:**
   - Look for log: `✅ Call was answered - allowing disposition`
   - If you don't see this, validation might not be executing

## Quick Fixes

### If validation is too strict:
Comment out the validation block temporarily:
```typescript
// if (requiresAnswer && agentEmail && leadPhone) {
//   ... validation code ...
// }
```

### If phone matching is broken:
Add more phone format variations or check the actual format in database.

### If time window is too short:
Change `oneHourAgo` to `twentyFourHoursAgo`:
```typescript
const twentyFourHoursAgo = new Date();
twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
```

## Test Scripts

Run `node test-disposition-debug.mjs` to test the validation logic locally.

Run `node test-disposition-validation.mjs` to test the actual API endpoint (requires real data).


