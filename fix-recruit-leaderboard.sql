-- FIX RECRUIT LEADERBOARD: Update connects and ensure status is synced

-- Step 1: Update all connects from recruit_candidates (this should be called by scheduler)
SELECT update_live_call_boardt_recruit_connects();

-- Step 2: Verify connects are being calculated
SELECT 
  agent_email,
  today_connects,
  today_dialed,
  today_reached,
  today_booked,
  status
FROM live_call_boardt_recruit
WHERE today_connects > 0 OR today_dialed > 0
ORDER BY today_connects DESC
LIMIT 10;

-- Step 3: Check if there are any recruit candidates today
SELECT 
  COUNT(*) as total_candidates_today,
  COUNT(DISTINCT agent_email) as unique_agents
FROM recruit_candidates
WHERE created_at >= date_trunc('day', (now() AT TIME ZONE 'America/Los_Angeles')::timestamp) AT TIME ZONE 'America/Los_Angeles'
  AND created_at < date_trunc('day', (now() AT TIME ZONE 'America/Los_Angeles')::timestamp) AT TIME ZONE 'America/Los_Angeles' + interval '1 day'
  AND agent_email IS NOT NULL;

-- Step 4: Check status distribution
SELECT 
  status,
  COUNT(*) as count
FROM live_call_boardt_recruit
GROUP BY status;
