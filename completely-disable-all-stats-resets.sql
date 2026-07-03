-- ============================================================================
-- COMPLETELY DISABLE ALL STATS RESETS
-- 
-- This script will:
-- 1. Remove any triggers that might be resetting stats
-- 2. Disable any cron jobs that might be calling update functions
-- 3. Modify the update function to NEVER reset stats to 0
-- ============================================================================

-- Step 1: Drop any triggers that might be calling update functions
DROP TRIGGER IF EXISTS trigger_update_live_call_board_on_metric ON agent_dial_metrics;
DROP TRIGGER IF EXISTS trigger_update_live_call_board_on_metric_update ON agent_dial_metrics;

-- Step 2: Disable any cron jobs that might be calling update functions
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN 
    SELECT jobid, jobname
    FROM cron.job
    WHERE command LIKE '%update_live_call_board%'
       OR command LIKE '%live_call_board%'
  LOOP
    BEGIN
      PERFORM cron.unschedule(rec.jobid::text);
      RAISE NOTICE '✅ Disabled cron job: % (ID: %)', COALESCE(rec.jobname, 'unnamed'), rec.jobid;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '⚠️ Could not disable cron job %: %', rec.jobid, SQLERRM;
    END;
  END LOOP;
END $$;

-- Step 3: Replace the update function to NEVER reset stats to 0
-- It will ONLY update stats for agents who have metrics today
-- It will NOT touch agents who don't have metrics (preserves existing values)
CREATE OR REPLACE FUNCTION update_live_call_board_stats_from_metrics()
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
  -- CRITICAL: This ONLY updates agents who have metrics today
  -- It does NOT reset stats to 0 for agents without metrics
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

-- Step 4: Also update the per-agent function to use GREATEST
CREATE OR REPLACE FUNCTION update_live_call_board_stats_for_agent(p_agent_email text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  today_start timestamptz;
  today_end timestamptz;
  dialed_count integer;
  reached_count integer;
  booked_count integer;
BEGIN
  -- Get today's date range in PST timezone
  today_start := date_trunc('day', (now() AT TIME ZONE 'America/Los_Angeles')::timestamp) AT TIME ZONE 'America/Los_Angeles';
  today_end := today_start + interval '1 day';
  
  -- Get counts for this agent today
  SELECT 
    COUNT(DISTINCT CASE WHEN event_type = 'dial' THEN lead_phone END) as dialed,
    COUNT(DISTINCT CASE WHEN event_type = 'reach' THEN lead_phone END) as reached,
    COUNT(DISTINCT CASE WHEN (event_type = 'booked' OR LOWER(COALESCE(disposition, '')) = 'booked') THEN lead_phone END) as booked
  INTO dialed_count, reached_count, booked_count
  FROM agent_dial_metrics
  WHERE agent_email = p_agent_email
    AND event_timestamp >= today_start
    AND event_timestamp < today_end
    AND lead_phone IS NOT NULL;
  
  -- Update live_call_board (create row if it doesn't exist)
  INSERT INTO live_call_board (
    agent_email,
    status,
    today_dialed,
    today_reached,
    today_booked,
    updated_at
  )
  VALUES (
    p_agent_email,
    'offline',
    COALESCE(dialed_count, 0),
    COALESCE(reached_count, 0),
    COALESCE(booked_count, 0),
    now()
  )
  ON CONFLICT (agent_email) 
  DO UPDATE SET
    -- Use GREATEST to ensure stats only increase, never decrease
    today_dialed = GREATEST(COALESCE(live_call_board.today_dialed, 0), COALESCE(dialed_count, 0)),
    today_reached = GREATEST(COALESCE(live_call_board.today_reached, 0), COALESCE(reached_count, 0)),
    today_booked = GREATEST(COALESCE(live_call_board.today_booked, 0), COALESCE(booked_count, 0)),
    updated_at = now();
END;
$$;

-- Step 5: Recreate the trigger (but it will use the updated function with GREATEST)
CREATE OR REPLACE FUNCTION trigger_update_live_call_board_on_metric()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update stats for this agent when a new metric is inserted
  IF NEW.agent_email IS NOT NULL AND NEW.agent_email != '' THEN
    PERFORM update_live_call_board_stats_for_agent(NEW.agent_email);
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_live_call_board_on_metric
  AFTER INSERT ON agent_dial_metrics
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_live_call_board_on_metric();

-- Final confirmation
DO $$
BEGIN
  RAISE NOTICE '✅ All stats reset sources have been disabled!';
  RAISE NOTICE '   - Triggers recreated with GREATEST logic (stats only increase)';
  RAISE NOTICE '   - Cron jobs disabled';
  RAISE NOTICE '   - Update functions modified to never reset to 0';
END $$;

