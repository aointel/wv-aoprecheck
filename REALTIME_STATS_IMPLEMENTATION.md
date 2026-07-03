# Real-Time Dial/Reach/Booked Stats Implementation

## Overview

All dial/reach/booked stats are now calculated **locally in real-time** from `agent_dial_metrics` table, **bypassing Supabase SQL functions and the `live_call_boardt` table**.

## What Changed

### 1. **Real-Time Calculation Function**
- **File**: `server/scripts/calculate-dial-reach-booked-realtime.ts`
- **Function**: `calculateDialReachBookedRealtime(agentEmail?: string)`
- **What it does**:
  - Queries `agent_dial_metrics` directly
  - Calculates stats locally (no SQL functions)
  - Uses EST timezone for "today" boundaries
  - Counts distinct phone numbers per event type

### 2. **Updated API Endpoints**

#### `/api/outbound-dialer/daily-stats` (Call Connector Pro)
- **Before**: Queried `live_call_boardt` table
- **After**: Uses `calculateDialReachBookedRealtime()` function
- **Used by**: Call Connector Pro interface (updates every 30 seconds)

#### `/api/leaderboard` (Leaderboard)
- **Before**: Manual queries to `twilio_call_logs` and `agent_dial_metrics`
- **After**: Uses `calculateDialReachBookedRealtime()` function
- **Used by**: Leaderboard component (updates every 15 seconds)

#### `/api/live-call-board/outbound-stats` (Live Call Board Totals)
- **Before**: Queried `live_call_boardt` table
- **After**: Uses `calculateDialReachBookedRealtime()` function
- **Used by**: Live Call Board totals display

#### `/api/live-call-board/agents` (Live Call Board Agents)
- **Before**: Used `live-call-board-calculator` module
- **After**: Uses `calculateDialReachBookedRealtime()` function
- **Used by**: Live Call Board individual agent stats

## How It Works

### Correct Counting Methodology:
1. **DIALS**: `COUNT(DISTINCT lead_phone) WHERE event_type = 'dial'`
2. **REACHES**: `COUNT(DISTINCT lead_phone) WHERE event_type = 'reach'`
3. **BOOKED**: `COUNT(DISTINCT lead_phone) WHERE event_type = 'booked'`

### Key Features:
- ✅ **No SQL functions** - All calculations done in Node.js
- ✅ **No `live_call_boardt` dependency** - Bypasses aggregated table
- ✅ **EST timezone** - Proper "today" boundaries
- ✅ **Distinct phone counting** - Each phone counts once per day
- ✅ **Real-time** - Always up-to-date, no caching delays

## Benefits

1. **Accuracy**: Direct from source data (`agent_dial_metrics`)
2. **Real-time**: No dependency on SQL triggers or cron jobs
3. **Consistency**: Same calculation logic everywhere
4. **Performance**: Local calculation is fast
5. **Reliability**: No SQL function failures or table sync issues

## Usage

### Run Script Manually:
```bash
npm run calculate-dial-reach-booked
```

### API Endpoints (Automatic):
- All endpoints now use real-time calculation automatically
- No configuration needed
- Stats update in real-time as events are logged

## Fallback Behavior

If real-time calculation fails, endpoints fall back to:
- `live_call_boardt` table (if available)
- Returns zeros if all else fails

This ensures the system never breaks even if calculation has issues.

## Testing

To verify stats are correct:
1. Run the calculation script: `npm run calculate-dial-reach-booked`
2. Check Call Connector Pro - stats should match
3. Check Leaderboard - stats should match
4. Check Live Call Board - stats should match

All should show the same numbers since they all use the same calculation function.
