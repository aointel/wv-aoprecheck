# Live Call Board Stats - Script-Based Solution

## Problem

SQL functions were unreliable for calculating live call board stats. Issues included:
1. Date range calculation was wrong (using 11/23 instead of 11/22)
2. Booked appointments weren't being counted correctly
3. SQL triggers and cron jobs were unreliable

## Solution

Created a Node.js script (`update-live-call-board-stats.cjs`) that:
1. **Correctly calculates PST date range** - Uses JavaScript to get current PST date/time
2. **Counts by event_type** - Dials, reaches, and booked are counted separately
3. **Fallback for booked** - If `event_type='booked'` events aren't logged, counts `disposition='booked'` as fallback
4. **Updates live_call_board** - Upserts stats for all agents

## How It Works

### Counting Logic

1. **DIALS**: `COUNT(DISTINCT lead_phone) WHERE event_type = 'dial'`
2. **REACHES**: `COUNT(DISTINCT lead_phone) WHERE event_type = 'reach'`
3. **BOOKED**: 
   - First tries: `COUNT(DISTINCT lead_phone) WHERE event_type = 'booked'`
   - Fallback: `COUNT(DISTINCT lead_phone) WHERE disposition = 'booked'`

### Date Range

- Gets current PST date/time
- Calculates midnight PST today to midnight PST tomorrow
- Converts to UTC for database queries
- Handles DST automatically (PST vs PDT)

## Usage

### Run Manually
```bash
node update-live-call-board-stats.cjs
```

### Via API
```bash
POST /api/live-call-board/sync-today-stats
```

### Schedule with Cron (Recommended)
```bash
# Run every 5 minutes
*/5 * * * * cd /path/to/AOI && node update-live-call-board-stats.cjs
```

## Current Status

✅ **Working correctly:**
- Date calculation: 11/22 (correct)
- Dials: 537 total
- Reaches: 71 total
- Booked: 29 total (using fallback)

⚠️ **Note:** Using fallback for booked counts because `event_type='booked'` events aren't being logged. Need to investigate why `logCallOutcome()` isn't creating `event_type='booked'` events.

## Next Steps

1. **Investigate booked event logging** - Why aren't `event_type='booked'` events being created?
2. **Set up cron job** - Automate the script to run every 5 minutes
3. **Remove SQL functions** - Once script is proven reliable, can remove SQL triggers/functions


































