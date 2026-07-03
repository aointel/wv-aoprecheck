# FIX: Live Call Board Booked Appointments Not Counting

## Problem

The live call board shows **0 booked appointments** for all agents, but there are actually **30+ booked appointments** today.

## Root Cause

The SQL function `update_live_call_board_stats_from_metrics()` was looking for:
- `event_type = 'booked'` AND `disposition = 'booked'`

But the actual data shows:
- `event_type = 'dial'` or `'reach'` with `disposition = 'booked'`

So booked appointments were never being counted!

## Fix

The SQL file `update-live-call-board-from-agent-dial-metrics.sql` has been updated to count **ANY event with `disposition='booked'`**, regardless of event_type.

## How to Apply the Fix

1. **Go to Supabase Dashboard > Database > SQL Editor**

2. **Run the updated SQL file:**
   - Copy the contents of `update-live-call-board-from-agent-dial-metrics.sql`
   - Paste into SQL Editor
   - Execute

3. **Manually trigger sync to fix existing data:**
   ```sql
   SELECT update_live_call_board_stats_from_metrics();
   ```

## Verification

After running the fix, check:
```sql
SELECT 
  agent_email,
  today_dialed,
  today_reached,
  today_booked
FROM live_call_board
WHERE today_booked > 0
ORDER BY today_booked DESC;
```

You should see agents with booked counts matching the actual appointments set today.

## Current Booked Counts (as of check)

- ankitadas@aoglobelife.com: **10 booked**
- sajadaljanaby@aoglobelife.com: **4 booked**
- joshshirley@aoglobelife.com: **3 booked**
- allanduvauchelle@aoglobelife.com: **2 booked**
- zacharyarcane@aoglobelife.com: **2 booked**
- edwardwerthner@aoglobelife.com: **2 booked**
- Plus 7 other agents with 1 booked each
- **Total: 30+ booked appointments today**


































