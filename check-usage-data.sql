-- Check if weekly_usage_stats table has any data
SELECT 
  'weekly_usage_stats' as table_name,
  COUNT(*) as row_count,
  MIN(week_start_date) as earliest_week,
  MAX(week_start_date) as latest_week
FROM weekly_usage_stats;

-- Check current week start date
SELECT 
  'Current Week Info' as info,
  DATE_TRUNC('week', CURRENT_DATE)::DATE as current_week_start,
  (DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '6 days')::DATE as current_week_end,
  CURRENT_DATE as today;

-- Show all weekly stats data
SELECT 
  agent_email,
  week_start_date,
  week_end_date,
  total_logins,
  unique_login_days,
  total_online_minutes,
  vdp_connects_received,
  vdp_total_minutes,
  total_dials_made,
  total_call_minutes,
  appointments_scheduled,
  sales_made,
  total_alp,
  last_activity_at,
  updated_at
FROM weekly_usage_stats
ORDER BY week_start_date DESC, agent_email;

-- Check agent_activity_log
SELECT 
  'agent_activity_log' as table_name,
  COUNT(*) as row_count,
  MIN(timestamp) as earliest_activity,
  MAX(timestamp) as latest_activity
FROM agent_activity_log;

-- Show recent activity
SELECT 
  agent_email,
  activity_type,
  session_id,
  timestamp
FROM agent_activity_log
ORDER BY timestamp DESC
LIMIT 20;

