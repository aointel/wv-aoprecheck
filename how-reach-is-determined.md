# How "Reach" is Determined

## Function: `isReachedDisposition(disposition, duration)`

Located in: `server/agent-dial-metrics-tracker.ts`

### Logic Flow:

1. **If NO disposition provided** → Returns `false` (not reached)

2. **Check for "NOT reached" dispositions FIRST** (these NEVER count as reached):
   - `no_answer`
   - `busy`
   - `failed`
   - `voicemail`
   - `bad_number`
   - `no_answer_vm`
   - `no_answer_voicemail`
   - `wrong_number`
   - `wrong number`
   
   If disposition matches any of these → Returns `false` (not reached)

3. **Check for "reached" dispositions** (these indicate human contact):
   - `contacted`
   - `connected`
   - `talked`
   - `qualified`
   - `interested`
   - `not_interested`
   - `transfer`
   - `appointment`
   - `booked`
   - `callback_scheduled`
   - `call_back`
   - `callback`
   - `sale`
   
   If disposition matches AND:
   - If duration is provided and > 0: Requires **duration >= 15 seconds**
   - If duration is 0/null/undefined: Still counts as reached (disposition alone is enough)
   
   → Returns `true` (reached)

4. **Default fallback** (if disposition doesn't match any list):
   - If duration >= 15 seconds → Returns `true` (reached)
   - Otherwise → Returns `false` (not reached)

## Summary

**A call is counted as "reached" if:**
- Disposition is in the "reached" list AND (duration >= 15 seconds OR no duration provided)
- OR disposition is not in either list AND duration >= 15 seconds

**A call is NEVER counted as "reached" if:**
- Disposition is in the "not reached" list (wrong_number, no_answer, etc.)
- OR no disposition provided and duration < 15 seconds

## Current Issue

Arthur Scott has 57 reached because:
- Each call with a "reached" disposition (contacted, connected, talked, etc.) logs a reach event
- If duration >= 15 seconds, it also counts as reached
- There's NO limit on how many reach events can be logged per day
- The system trusts the disposition and duration values provided

