-- ============================================================================
-- SETUP PERIODIC LIVE_CALL_BOARD UPDATE
-- 
-- This sets up a periodic job to run update_live_call_board_stats_from_metrics()
-- every 5 minutes to ensure data stays in sync even if triggers miss something.
-- 
-- NOTE: This requires the pg_cron extension to be enabled in Supabase.
-- If pg_cron is not available, you'll need to set up an external cron job
-- or use Supabase's scheduled functions feature.
-- ============================================================================

-- Check if pg_cron extension exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE '✅ pg_cron extension is available';
    
    -- Schedule job to run every 5 minutes
    -- Remove existing job if it exists
    PERFORM cron.unschedule('update-live-call-board-stats');
    
    -- Schedule new job (runs every 5 minutes)
    PERFORM cron.schedule(
      'update-live-call-board-stats',
      '*/5 * * * *',  -- Every 5 minutes
      $$SELECT update_live_call_board_stats_from_metrics();$$
    );
    
    RAISE NOTICE '✅ Scheduled job created: update-live-call-board-stats (runs every 5 minutes)';
  ELSE
    RAISE NOTICE '⚠️  pg_cron extension is NOT available';
    RAISE NOTICE '   You will need to:';
    RAISE NOTICE '   1. Enable pg_cron extension in Supabase dashboard, OR';
    RAISE NOTICE '   2. Set up an external cron job to run update-live-call-board-stats.cjs, OR';
    RAISE NOTICE '   3. Use Supabase Edge Functions with scheduled triggers';
  END IF;
END $$;

