-- ============================================================================
-- FIND ALL SOURCES THAT MIGHT BE RESETTING STATS
-- ============================================================================

-- 1. Check for any cron jobs that might be resetting
SELECT 
  'Cron Jobs' as source_type,
  jobid,
  jobname,
  schedule,
  command
FROM cron.job
WHERE command LIKE '%live_call_board%'
   OR command LIKE '%today_dialed%'
   OR command LIKE '%today_reached%'
   OR command LIKE '%today_booked%'
   OR command LIKE '%reset%'
   OR command LIKE '%backfill%';

-- 2. Check for any triggers that might be resetting
SELECT 
  'Triggers' as source_type,
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'live_call_board'
   OR action_statement LIKE '%today_dialed%'
   OR action_statement LIKE '%today_reached%'
   OR action_statement LIKE '%today_booked%';

-- 3. Check for any functions that update live_call_board
SELECT 
  'Functions' as source_type,
  routine_name,
  routine_definition
FROM information_schema.routines
WHERE routine_definition LIKE '%live_call_board%'
  AND routine_definition LIKE '%today_dialed%'
  AND (
    routine_definition LIKE '%= 0%'
    OR routine_definition LIKE '%SET today_dialed%'
  );

-- 4. Check recent updates to live_call_board (last hour)
SELECT 
  'Recent Updates' as source_type,
  agent_email,
  today_dialed,
  today_reached,
  today_booked,
  updated_at
FROM live_call_board
WHERE updated_at > now() - interval '1 hour'
  AND (today_dialed = 0 OR today_reached = 0 OR today_booked = 0)
ORDER BY updated_at DESC
LIMIT 20;

