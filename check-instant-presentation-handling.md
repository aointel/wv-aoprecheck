# How Instant Presentations Are Handled and Recorded

## Overview
Instant presentations are tracked as a separate event type in `agent_dial_metrics` and counted in the `today_instant_presentation` column of `live_call_boardt`.

## Current Implementation

### 1. **Logging Logic** (`server/agent-dial-metrics-tracker.ts`)
- **When logged**: When `disposition = 'instant_presentation'` is set
- **Event type**: `event_type = 'instant_presentation'`
- **Location**: Lines 813-822 in `logCallOutcome()`
- **No duration check**: Unlike booked/reached, instant_presentation events are logged regardless of duration (as long as validation passes)

### 2. **Validation Requirements** (`server/routes.ts` & `agent-dial-metrics-tracker.ts`)
- **Requires call_sid**: ✅ Yes (cannot be null)
- **Requires call_duration**: ✅ Yes, must be **> 60 seconds** (same as other general dispositions)
- **Not exempt**: Instant presentations are NOT in the exempt list, so they require validation
- **Validation location**: 
  - API level: `server/routes.ts` (line 17968) - requires call validation
  - Database level: `server/agent-dial-metrics-tracker.ts` (line 132, 187-190) - requires duration > 60s

### 3. **Counting in Live Call Board** (`update-live-call-board-from-agent-dial-metrics.sql`)
- **SQL Logic**: Counts distinct phones where:
  - `event_type = 'instant_presentation'` OR 
  - `disposition = 'instant_presentation'`
- **No duration check in SQL**: Unlike booked (which requires > 120s in SQL), instant_presentation has NO duration requirement in the SQL counting logic
- **Column**: `today_instant_presentation` in `live_call_boardt` table

### 4. **Rate Limiting**
- **Considered "booked disposition"**: Instant presentations count toward the combined booking/callback rate limit (max 8 per hour)
- **Duplicate prevention**: Only one instant_presentation event per phone per day (checked in `logDialMetric`)

### 5. **Webhook Integration**
- **Producer Resolution Code**: Maps to code `1` (Pres, No Sale) - same as booked
- **Sent to Planet ALTIG**: ✅ Yes, for hotleads with calls >= 60 seconds

## Potential Issues

1. **No duration requirement in SQL counting**: The SQL function counts instant_presentation events without checking duration, unlike booked which requires > 120s. This means an instant_presentation event with 1 second duration would still count.

2. **Validation vs Counting mismatch**: 
   - Validation requires duration > 60s
   - SQL counting has no duration check
   - This could lead to inconsistencies

3. **Similar to booked/reached issue**: If instant_presentation events are being logged but not showing up in the live call board, it might need a similar sync script.

## Recommendations

1. **Add duration check to SQL**: Should require duration > 60s (or whatever threshold you want) in the SQL counting logic, similar to how booked requires > 120s
2. **Sync script**: If needed, create a script similar to the booked/reached sync scripts to ensure instant_presentation events from masterlead are properly recorded
3. **Consistency**: Ensure the duration requirement is consistent between validation (60s) and SQL counting
