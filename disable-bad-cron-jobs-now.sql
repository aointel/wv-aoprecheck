-- DISABLE THE BAD CRON JOBS THAT ARE RESETTING YOUR DATA
-- Run this immediately to stop the old function from overwriting correct values

-- Step 1: Unschedule the cron job that runs every 2 minutes with OLD logic
SELECT cron.unschedule('update-live-call-boardt-stats-auto');

-- Step 2: Unschedule the midnight reset job (if you want to keep it, comment this out)
SELECT cron.unschedule('reset-live-call-boardt-stats-midnight');

-- Step 3: Drop the OLD function that uses wrong logic
DROP FUNCTION IF EXISTS update_live_call_boardt_stats_auto() CASCADE;

-- Step 4: Verify they're gone
SELECT 
  jobid,
  jobname,
  schedule,
  command,
  active,
  CASE WHEN active THEN 'STILL RUNNING ⚠️' ELSE 'STOPPED ✅' END as status
FROM cron.job
WHERE jobname IN ('update-live-call-boardt-stats-auto', 'reset-live-call-boardt-stats-midnight')
ORDER BY jobid;

-- Step 5: Verify the old function is gone
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.routines 
      WHERE routine_name = 'update_live_call_boardt_stats_auto'
    ) THEN '❌ OLD FUNCTION STILL EXISTS'
    ELSE '✅ OLD FUNCTION REMOVED'
  END as function_status;

-- Step 6: Verify the CORRECT function exists
SELECT 
  routine_name,
  '✅ CORRECT FUNCTION EXISTS' as status
FROM information_schema.routines
WHERE routine_name = 'update_live_call_boardt_stats_from_metrics'
  AND routine_schema = 'public';

