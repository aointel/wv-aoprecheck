-- ============================================================================
-- SETUP AUTO-UPDATE FOR LIVE_CALL_BOARD WITH CRON JOB
-- 
-- This script:
-- 1. Creates a function to update live_call_board stats
-- 2. Sets up a pg_cron job to run it every 2 minutes
-- ============================================================================

-- Step 1: Ensure pg_cron extension is enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Step 2: Create/Replace the update function
-- This function updates stats using GREATEST to prevent resets
CREATE OR REPLACE FUNCTION update_live_call_board_stats_auto()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  today_start timestamptz;
  today_end timestamptz;
BEGIN
  -- Get today's date range in PST timezone
  today_start := date_trunc('day', (now() AT TIME ZONE 'America/Los_Angeles')::timestamp) AT TIME ZONE 'America/Los_Angeles';
  today_end := today_start + interval '1 day';
  
  -- Update live_call_board with today's stats from agent_dial_metrics
  -- CALCULATE ALL METRICS AT ONCE - Each phone counts once per event type
  --   - DIALS: Count distinct phones where event_type = 'dial'
  --   - REACHES: Count distinct phones where event_type = 'reach'
  --   - BOOKED: Count distinct phones where event_type = 'booked' OR disposition = 'booked'
  -- 
  -- CRITICAL: Uses GREATEST to ensure stats only increase, never decrease
  INSERT INTO live_call_board (
    agent_email,
    status,
    today_dialed,
    today_reached,
    today_booked,
    updated_at
  )
  SELECT 
    agent_email,
    'offline' as status,
    COUNT(DISTINCT CASE WHEN event_type = 'dial' THEN lead_phone END) as dialed,
    COUNT(DISTINCT CASE WHEN event_type = 'reach' THEN lead_phone END) as reached,
    COUNT(DISTINCT CASE WHEN (event_type = 'booked' OR LOWER(COALESCE(disposition, '')) = 'booked') THEN lead_phone END) as booked,
    now() as updated_at
  FROM agent_dial_metrics
  WHERE event_timestamp >= today_start
    AND event_timestamp < today_end
    AND agent_email IS NOT NULL
    AND agent_email != ''
    AND lead_phone IS NOT NULL
  GROUP BY agent_email
  ON CONFLICT (agent_email) 
  DO UPDATE SET
    -- Use GREATEST to ensure stats only increase, never decrease
    -- This prevents stats from being reset to 0 if the new count is lower
    today_dialed = GREATEST(COALESCE(live_call_board.today_dialed, 0), COALESCE(EXCLUDED.today_dialed, 0)),
    today_reached = GREATEST(COALESCE(live_call_board.today_reached, 0), COALESCE(EXCLUDED.today_reached, 0)),
    today_booked = GREATEST(COALESCE(live_call_board.today_booked, 0), COALESCE(EXCLUDED.today_booked, 0)),
    updated_at = EXCLUDED.updated_at;
  
  -- NO RESET LOGIC - Stats will only be updated for agents with metrics today
  -- Agents without metrics will keep their existing stats
END;
$$;

-- Step 3: Remove any existing cron job with the same name
SELECT cron.unschedule('update-live-call-board-stats-auto')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'update-live-call-board-stats-auto'
);

-- Step 4: Schedule the cron job to run every 2 minutes
-- Cron format: minute hour day month weekday
-- '*/2 * * * *' = every 2 minutes
SELECT cron.schedule(
  'update-live-call-board-stats-auto',  -- Job name
  '*/2 * * * *',                        -- Schedule: every 2 minutes
  $$SELECT update_live_call_board_stats_auto();$$  -- Command to run
);

-- Step 5: Verify the cron job was created
DO $$
DECLARE
  job_count integer;
BEGIN
  SELECT COUNT(*) INTO job_count
  FROM cron.job
  WHERE jobname = 'update-live-call-board-stats-auto';
  
  IF job_count > 0 THEN
    RAISE NOTICE '✅ Cron job created successfully!';
    RAISE NOTICE '   Job name: update-live-call-board-stats-auto';
    RAISE NOTICE '   Schedule: Every 2 minutes (*/2 * * * *)';
    RAISE NOTICE '   Function: update_live_call_board_stats_auto()';
  ELSE
    RAISE NOTICE '⚠️  Cron job may not have been created. Check pg_cron extension.';
  END IF;
END $$;

-- Step 6: Show all cron jobs for verification
SELECT 
  jobid,
  jobname,
  schedule,
  command,
  active,
  CASE WHEN active THEN 'YES ✅' ELSE 'NO ❌' END as status
FROM cron.job
WHERE jobname = 'update-live-call-board-stats-auto'
ORDER BY jobid;

