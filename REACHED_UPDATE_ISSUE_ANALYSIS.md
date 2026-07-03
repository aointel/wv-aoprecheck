# Reached Count Not Updating - Analysis

## Problem
The "reached" count hasn't updated in 15 minutes, showing 77 reached but should be higher.

## Investigation Findings

### 1. Data Check
- **Total dials today**: 89
- **Total reaches today**: 5 (from `agent_dial_metrics`)
- **Last reach event**: 0 minutes ago (most recent)

### 2. Issue Identified
Many calls with:
- `disposition: no_answer_vm`
- `duration > 45 seconds`

Are NOT creating reach events, even though the 45-second fallback rule should apply.

**Example**: `seanhaggard@aoglobelife.com | 2626611780 | Duration: 84s | Disposition: no_answer_vm`

### 3. Code Review

The fallback logic exists in `server/agent-dial-metrics-tracker.ts` (lines 726-729):
```typescript
if (!isReached && realCallDuration && realCallDuration > 45) {
  console.log(`⚠️ FALLBACK REACH: Disposition=${disposition || 'null'} but duration=${realCallDuration}s > 45s - automatically counting as reached`);
  isReached = true;
}
```

**This should be working, but it's not creating reach events.**

### 4. Possible Causes

1. **Duration not being passed correctly**: The `callDuration` from the frontend might not be reaching `logCallOutcome` correctly.

2. **Disposition set before duration known**: Calls might be logged with disposition before the final duration is calculated.

3. **Duplicate prevention**: The duplicate check in `logDialMetric` (lines 105-124) might be preventing reach events if a dial event was already created.

4. **Calculation issue**: The real-time calculation might not be counting recent reach events correctly.

### 5. Next Steps

1. **Check server logs**: Look for `FALLBACK REACH` log messages to see if the fallback is being triggered.

2. **Verify duration parsing**: Ensure `callDuration` is being parsed correctly in `/api/outbound-dialer/save-disposition` (lines 17257-17262).

3. **Check duplicate prevention**: Verify that the duplicate check isn't blocking reach events for calls that already have dial events.

4. **Add more logging**: Add detailed logging to see exactly what's happening when `logCallOutcome` is called with `no_answer_vm` and `duration > 45`.

### 6. Immediate Fix

The most likely issue is that the frontend isn't sending the correct `callDuration` when the disposition is `no_answer_vm`, OR the duration is being lost somewhere in the processing chain.

**Recommendation**: Check the frontend code to ensure `callDurationSeconds` is being sent correctly in the `/api/outbound-dialer/save-disposition` request body (line 4861 in `OutboundDialerInterface.tsx`).
