-- ============================================================================
-- CHECK AND DISABLE SUPABASE CRON JOBS
-- 
-- This script checks for any pg_cron jobs that might be resetting live_call_board
-- and disables them.
-- ============================================================================

-- Step 1: Check if pg_cron extension exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE '✅ pg_cron extension is available';
  ELSE
    RAISE NOTICE '⚠️  pg_cron extension is NOT available - no cron jobs can be running';
    RETURN;
  END IF;
END $$;

-- Step 2: List all cron jobs
DO $$
DECLARE
  rec RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '📋 All scheduled cron jobs:';
  
  FOR rec IN 
    SELECT 
      jobid,
      schedule,
      command,
      nodename,
      nodeport,
      database,
      username,
      active
    FROM cron.job
    ORDER BY jobid
  LOOP
    RAISE NOTICE '   Job ID: %', rec.jobid;
    RAISE NOTICE '   Schedule: %', rec.schedule;
    RAISE NOTICE '   Command: %', rec.command;
    RAISE NOTICE '   Active: %', rec.active;
    RAISE NOTICE '';
  END LOOP;
END $$;

-- Step 3: Find and disable any jobs related to live_call_board
DO $$
DECLARE
  rec RECORD;
  disabled_count integer := 0;
BEGIN
  RAISE NOTICE '🔍 Searching for jobs related to live_call_board...';
  
  FOR rec IN 
    SELECT 
      jobid,
      schedule,
      command
    FROM cron.job
    WHERE command LIKE '%live_call_board%'
       OR command LIKE '%update_live_call_board%'
       OR command LIKE '%live-call-board%'
  LOOP
    RAISE NOTICE '   ⚠️  Found job ID %: %', rec.jobid, rec.command;
    
    -- Disable the job (safer than unschedule - preserves job config)
    UPDATE cron.job
    SET active = false
    WHERE jobid = rec.jobid;
    
    disabled_count := disabled_count + 1;
    RAISE NOTICE '   ✅ Disabled job ID %', rec.jobid;
  END LOOP;
  
  IF disabled_count = 0 THEN
    RAISE NOTICE '✅ No live_call_board cron jobs found';
  ELSE
    RAISE NOTICE '✅ Disabled % cron job(s)', disabled_count;
  END IF;
END $$;

-- Step 4: Alternative - disable by job name if it exists
DO $$
DECLARE
  updated_count integer;
BEGIN
  -- Try to disable by common job names (safer than unschedule)
  UPDATE cron.job
  SET active = false
  WHERE jobname = 'update-live-call-board-stats';
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  IF updated_count > 0 THEN
    RAISE NOTICE '✅ Disabled job: update-live-call-board-stats';
  ELSE
    RAISE NOTICE 'ℹ️  Job update-live-call-board-stats not found (this is OK)';
  END IF;
  
  UPDATE cron.job
  SET active = false
  WHERE jobname = 'sync-live-call-board';
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  IF updated_count > 0 THEN
    RAISE NOTICE '✅ Disabled job: sync-live-call-board';
  ELSE
    RAISE NOTICE 'ℹ️  Job sync-live-call-board not found (this is OK)';
  END IF;
END $$;

-- Final confirmation
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Cron job check complete!';
  RAISE NOTICE '   If any jobs were found and disabled, they will no longer reset your data.';
END $$;

