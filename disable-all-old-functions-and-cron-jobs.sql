-- DISABLE ALL OLD FUNCTIONS AND CRON JOBS THAT MIGHT BE RESETTING live_call_boardt
-- Run this to stop anything that's overwriting your data

-- Step 1: Drop the OLD function that uses wrong logic (event_type='reach' instead of call_status='completed')
DROP FUNCTION IF EXISTS update_live_call_boardt_stats_auto() CASCADE;

-- Step 2: Unschedule any cron jobs that might be running old functions
DO $$
BEGIN
  -- Try to unschedule the old cron job
  PERFORM cron.unschedule('update-live-call-boardt-stats-auto');
EXCEPTION WHEN OTHERS THEN
  -- Job doesn't exist, that's fine
  NULL;
END $$;

-- Step 3: List ALL cron jobs to see what's running
SELECT 
  jobid,
  jobname,
  schedule,
  command,
  active,
  CASE WHEN active THEN 'RUNNING ⚠️' ELSE 'STOPPED ✅' END as status
FROM cron.job
WHERE command LIKE '%live_call_boardt%'
   OR command LIKE '%update_live_call_boardt%'
   OR command LIKE '%update_live_call_board%'
   OR jobname LIKE '%live_call_board%'
ORDER BY jobid;

-- Step 4: Show what functions currently exist
SELECT 
  routine_name,
  routine_type,
  CASE 
    WHEN routine_definition LIKE '%event_type%reach%' THEN '❌ OLD LOGIC (uses event_type=reach)'
    WHEN routine_definition LIKE '%call_status%completed%' THEN '✅ NEW LOGIC (uses call_status=completed)'
    ELSE '⚠️ UNKNOWN LOGIC'
  END as logic_type
FROM information_schema.routines
WHERE routine_definition LIKE '%live_call_boardt%'
  AND routine_schema = 'public'
ORDER BY routine_name;

-- Step 5: Verify the CORRECT function exists
SELECT 
  routine_name,
  '✅ CORRECT FUNCTION EXISTS' as status
FROM information_schema.routines
WHERE routine_name = 'update_live_call_boardt_stats_from_metrics'
  AND routine_schema = 'public';

