-- VERIFY: Check that the bad cron job and old function are gone
-- Run this to confirm the fix worked

-- Step 1: Check if the bad cron job is still running
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM cron.job 
      WHERE jobname = 'update-live-call-boardt-stats-auto' 
        AND active = true
    ) THEN '❌ BAD CRON JOB STILL RUNNING - RUN disable-bad-cron-jobs-now.sql'
    ELSE '✅ BAD CRON JOB DISABLED'
  END as cron_status;

-- Step 2: Check if the old function still exists
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.routines 
      WHERE routine_name = 'update_live_call_boardt_stats_auto'
    ) THEN '❌ OLD FUNCTION STILL EXISTS - RUN disable-bad-cron-jobs-now.sql'
    ELSE '✅ OLD FUNCTION REMOVED'
  END as function_status;

-- Step 3: Verify the correct function exists and uses correct logic
SELECT 
  routine_name,
  CASE 
    WHEN routine_definition LIKE '%call_status%completed%' 
      AND routine_definition LIKE '%event_type%dial%' 
    THEN '✅ USES CORRECT LOGIC (call_status=completed)'
    WHEN routine_definition LIKE '%event_type%reach%' 
    THEN '❌ USES OLD LOGIC (event_type=reach)'
    ELSE '⚠️ UNKNOWN LOGIC'
  END as logic_check
FROM information_schema.routines
WHERE routine_name = 'update_live_call_boardt_stats_from_metrics'
  AND routine_schema = 'public';

-- Step 4: List all active cron jobs (should NOT see update-live-call-boardt-stats-auto)
SELECT 
  jobid,
  jobname,
  schedule,
  command,
  CASE WHEN active THEN 'RUNNING ⚠️' ELSE 'STOPPED ✅' END as status
FROM cron.job
WHERE active = true
ORDER BY jobid;

-- Step 5: Check triggers are set up correctly
SELECT 
  tgname as trigger_name,
  CASE tgenabled
    WHEN 'O' THEN 'ENABLED ✅'
    WHEN 'D' THEN 'DISABLED ❌'
    ELSE 'UNKNOWN'
  END as status
FROM pg_trigger
WHERE tgrelid = 'agent_dial_metrics'::regclass
  AND tgname LIKE '%live_call_boardt%'
ORDER BY tgname;

