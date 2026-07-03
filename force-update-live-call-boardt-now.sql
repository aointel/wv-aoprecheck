-- FORCE UPDATE: Manually update live_call_boardt table RIGHT NOW
-- Run this to immediately update all agents' stats

-- Step 1: First, make sure the functions are updated with the latest code
-- (This should match update-live-call-board-from-agent-dial-metrics.sql)

-- Step 2: Force update all agents immediately
SELECT update_live_call_boardt_stats_from_metrics();

-- Step 3: Verify the update worked
SELECT 
  agent_email,
  today_dialed,
  today_reached,
  today_booked,
  updated_at,
  now() - updated_at as time_since_update
FROM live_call_boardt
ORDER BY updated_at DESC
LIMIT 20;

-- Step 4: Check if there are metrics that should be counted
SELECT 
  'Total metrics today' as metric,
  COUNT(*) as count
FROM agent_dial_metrics
WHERE event_timestamp >= (SELECT today_start FROM get_today_est_range())
  AND event_timestamp < (SELECT today_end FROM get_today_est_range())
  AND agent_email IS NOT NULL
  AND agent_email != ''
  AND lead_phone IS NOT NULL

UNION ALL

SELECT 
  'Distinct dialed phones' as metric,
  COUNT(DISTINCT CASE WHEN LOWER(event_type) = 'dial' THEN lead_phone END) as count
FROM agent_dial_metrics
WHERE event_timestamp >= (SELECT today_start FROM get_today_est_range())
  AND event_timestamp < (SELECT today_end FROM get_today_est_range())
  AND agent_email IS NOT NULL
  AND agent_email != ''
  AND lead_phone IS NOT NULL

UNION ALL

SELECT 
  'Distinct reached phones (call_status=completed)' as metric,
  COUNT(DISTINCT CASE WHEN LOWER(COALESCE(call_status, '')) = 'completed' AND LOWER(event_type) = 'dial' THEN lead_phone END) as count
FROM agent_dial_metrics
WHERE event_timestamp >= (SELECT today_start FROM get_today_est_range())
  AND event_timestamp < (SELECT today_end FROM get_today_est_range())
  AND agent_email IS NOT NULL
  AND agent_email != ''
  AND lead_phone IS NOT NULL

UNION ALL

SELECT 
  'Distinct booked phones' as metric,
  COUNT(DISTINCT CASE WHEN (LOWER(event_type) = 'booked' OR LOWER(COALESCE(disposition, '')) = 'booked') THEN lead_phone END) as count
FROM agent_dial_metrics
WHERE event_timestamp >= (SELECT today_start FROM get_today_est_range())
  AND event_timestamp < (SELECT today_end FROM get_today_est_range())
  AND agent_email IS NOT NULL
  AND agent_email != ''
  AND lead_phone IS NOT NULL;


