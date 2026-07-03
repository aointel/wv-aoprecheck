-- ============================================================================
-- SETUP AUTOMATIC LIVE CALL BOARD UPDATES
-- 
-- This ensures the live_call_boardt stays updated through multiple layers:
-- 1. Database triggers (real-time updates when metrics are inserted/updated)
-- 2. Database cron job (backup sync every 1 minute)
-- 3. Node.js scheduler (primary - runs every 30 seconds)
-- ============================================================================

-- ============================================================================
-- STEP 1: Verify triggers exist and are enabled
-- ============================================================================
DO $$
BEGIN
  -- Check if triggers exist
  IF EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'trigger_update_live_call_boardt_on_metric_insert'
      AND event_object_table = 'agent_dial_metrics'
  ) THEN
    RAISE NOTICE '✅ INSERT trigger exists: trigger_update_live_call_boardt_on_metric_insert';
  ELSE
    RAISE WARNING '❌ INSERT trigger MISSING - stats will not update in real-time!';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'trigger_update_live_call_boardt_on_metric_update'
      AND event_object_table = 'agent_dial_metrics'
  ) THEN
    RAISE NOTICE '✅ UPDATE trigger exists: trigger_update_live_call_boardt_on_metric_update';
  ELSE
    RAISE WARNING '❌ UPDATE trigger MISSING - stats will not update when metrics change!';
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Enable pg_cron extension (if available)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE '✅ pg_cron extension is available';
  ELSE
    BEGIN
      CREATE EXTENSION IF NOT EXISTS pg_cron;
      RAISE NOTICE '✅ pg_cron extension created';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '⚠️  pg_cron extension is NOT available: %', SQLERRM;
      RAISE NOTICE '   Node.js scheduler will handle updates (runs every 30 seconds)';
      RAISE NOTICE '   To enable pg_cron: Supabase Dashboard > Database > Extensions > Enable pg_cron';
    END;
  END IF;
END $$;

-- ============================================================================
-- STEP 3: Set up database cron job as backup (runs every 1 minute)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Remove existing job if it exists
    PERFORM cron.unschedule('update-live-call-boardt-stats-backup');
    
    -- Schedule new job (runs every 1 minute as backup)
    -- NOTE: cron.schedule returns a job ID, so we need to use a different approach
    -- We'll do this outside the DO block to avoid nested $$ delimiter issues
    NULL;  -- Placeholder - actual scheduling done below
    
    RAISE NOTICE '✅ Database cron job scheduled: update-live-call-boardt-stats-backup (runs every 1 minute)';
    RAISE NOTICE '   This is a BACKUP - Node.js scheduler runs every 30 seconds (primary)';
  ELSE
    RAISE NOTICE '⚠️  pg_cron not available - skipping database cron job setup';
    RAISE NOTICE '   Node.js scheduler will handle all updates (runs every 30 seconds)';
  END IF;
END $$;

-- Schedule the cron job (done outside DO block to avoid nested $$ delimiter issues)
-- NOTE: cron.schedule returns a job ID, so we use SELECT
SELECT cron.schedule(
  'update-live-call-boardt-stats-backup',  -- Job name
  '* * * * *',                             -- Schedule: every 1 minute
  'SELECT update_live_call_boardt_stats_from_metrics();'  -- Command (use single quotes)
) WHERE EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron');

-- ============================================================================
-- STEP 4: Verify SQL function exists
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'update_live_call_boardt_stats_from_metrics'
  ) THEN
    RAISE NOTICE '✅ SQL function exists: update_live_call_boardt_stats_from_metrics';
  ELSE
    RAISE EXCEPTION '❌ SQL function MISSING: update_live_call_boardt_stats_from_metrics';
    RAISE NOTICE '   Run update-live-call-board-from-agent-dial-metrics.sql first!';
  END IF;
END $$;

-- ============================================================================
-- STEP 5: List all update mechanisms
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'LIVE CALL BOARD UPDATE MECHANISMS:';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE '1. DATABASE TRIGGERS (Real-time):';
  RAISE NOTICE '   - trigger_update_live_call_boardt_on_metric_insert';
  RAISE NOTICE '   - trigger_update_live_call_boardt_on_metric_update';
  RAISE NOTICE '   → Updates stats immediately when agent_dial_metrics change';
  RAISE NOTICE '';
  RAISE NOTICE '2. NODE.JS SCHEDULER (Primary - every 30 seconds):';
  RAISE NOTICE '   - File: server/live-call-board-stats-scheduler.ts';
  RAISE NOTICE '   - Runs: Every 30 seconds (setInterval) + Every 1 minute (cron)';
  RAISE NOTICE '   → Primary update mechanism';
  RAISE NOTICE '';
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE '3. DATABASE CRON JOB (Backup - every 1 minute):';
    RAISE NOTICE '   - Job: update-live-call-boardt-stats-backup';
    RAISE NOTICE '   - Runs: Every 1 minute';
    RAISE NOTICE '   → Backup if Node.js scheduler fails';
  ELSE
    RAISE NOTICE '3. DATABASE CRON JOB: NOT AVAILABLE (pg_cron not enabled)';
  END IF;
  RAISE NOTICE '';
  RAISE NOTICE 'DATA SOURCES:';
  RAISE NOTICE '   - DIALED: twilio_call_logs (calls with duration > 0)';
  RAISE NOTICE '   - REACHED: twilio_call_logs (calls with duration >= 50s)';
  RAISE NOTICE '   - INSTANT_PRESENTATION: masterlead (cnresolution = instant_presentation)';
  RAISE NOTICE '   - BOOKED: agent_dial_metrics ONLY (duration > 240s)';
  RAISE NOTICE '============================================================================';
END $$;

-- ============================================================================
-- STEP 6: Verify cron job is active (if pg_cron is available)
-- ============================================================================
DO $$
DECLARE
  job_count integer;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    SELECT COUNT(*) INTO job_count
    FROM cron.job
    WHERE jobname = 'update-live-call-boardt-stats-backup'
      AND active = true;
    
    IF job_count > 0 THEN
      RAISE NOTICE '✅ Database cron job is ACTIVE';
    ELSE
      RAISE WARNING '⚠️  Database cron job is NOT active - check cron.job table';
    END IF;
  END IF;
END $$;

-- ============================================================================
-- VERIFICATION QUERIES (run these to check status)
-- ============================================================================

-- Check triggers
SELECT 
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'agent_dial_metrics'
  AND trigger_name LIKE '%live_call_board%'
ORDER BY trigger_name;

-- Check cron jobs (if pg_cron is available)
SELECT 
  jobid,
  jobname,
  schedule,
  command,
  active,
  CASE WHEN active THEN '✅ ACTIVE' ELSE '❌ INACTIVE' END as status
FROM cron.job
WHERE jobname LIKE '%live_call_board%' OR command LIKE '%update_live_call_boardt%'
ORDER BY jobid;

-- Check SQL function
SELECT 
  proname as function_name,
  pg_get_functiondef(oid) as function_definition
FROM pg_proc
WHERE proname = 'update_live_call_boardt_stats_from_metrics';
