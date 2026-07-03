-- ============================================================================
-- FIX CRON SYNTAX IN setup-live-call-board-auto-update.sql
-- 
-- The issue: cron.schedule returns a value, so use SELECT not PERFORM
-- Also need to fix the nested $$ delimiter issue
-- ============================================================================

-- Remove existing job if it exists
DO $$
-BEGIN
-  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
-    BEGIN
-      PERFORM cron.unschedule('update-live-call-boardt-stats-backup');
-    EXCEPTION WHEN OTHERS THEN
-      -- Job doesn't exist, that's fine
-      NULL;
-    END;
-  END IF;
-END $$;

-- Schedule new job (runs every 1 minute as backup)
-- NOTE: cron.schedule returns a job ID, so we use SELECT, not PERFORM
SELECT cron.schedule(
  'update-live-call-boardt-stats-backup',  -- Job name
  '* * * * *',                             -- Schedule: every 1 minute
  'SELECT update_live_call_boardt_stats_from_metrics();'  -- Command (use single quotes, not $$)
) WHERE EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron');
