-- ============================================================================
-- LIST ALL CRON JOBS
-- 
-- This script lists all scheduled cron jobs in Supabase
-- ============================================================================

-- Check if pg_cron extension exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE '✅ pg_cron extension is available';
  ELSE
    RAISE NOTICE '⚠️  pg_cron extension is NOT available - no cron jobs can be running';
    RETURN;
  END IF;
END $$;

-- List all cron jobs
DO $$
DECLARE
  rec RECORD;
  job_count integer := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '📋 All scheduled cron jobs:';
  RAISE NOTICE '';
  
  FOR rec IN 
    SELECT 
      jobid,
      schedule,
      command,
      nodename,
      nodeport,
      database,
      username,
      active,
      jobname
    FROM cron.job
    ORDER BY jobid
  LOOP
    job_count := job_count + 1;
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE 'Job ID: %', rec.jobid;
    IF rec.jobname IS NOT NULL THEN
      RAISE NOTICE 'Job Name: %', rec.jobname;
    END IF;
    RAISE NOTICE 'Schedule: %', rec.schedule;
    RAISE NOTICE 'Command: %', rec.command;
    RAISE NOTICE 'Active: %', CASE WHEN rec.active THEN 'YES ✅' ELSE 'NO ❌' END;
    RAISE NOTICE 'Database: %', rec.database;
    RAISE NOTICE 'Username: %', rec.username;
    RAISE NOTICE '';
  END LOOP;
  
  IF job_count = 0 THEN
    RAISE NOTICE 'ℹ️  No cron jobs found';
  ELSE
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE 'Total: % job(s)', job_count;
  END IF;
END $$;

