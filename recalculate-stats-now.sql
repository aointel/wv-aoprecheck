-- Quick script to recalculate booked and reached stats
-- Run this after fixing the SQL functions

-- Step 1: Recalculate all stats using the backfill function
SELECT backfill_live_call_boardt_stats_corrected();

-- Step 2: Verify counts (shows top 20 agents)
SELECT 
  agent_email,
  today_dialed,
  today_reached,
  today_booked,
  updated_at
FROM live_call_boardt
WHERE today_dialed > 0 OR today_reached > 0 OR today_booked > 0
ORDER BY today_booked DESC, today_reached DESC
LIMIT 20;
