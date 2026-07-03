-- FIX: Ensure live_call_boardt triggers are set up correctly
-- Run this in Supabase SQL Editor to fix the issue

-- Step 1: Ensure the EST range function exists (updated from PST)
CREATE OR REPLACE FUNCTION get_today_est_range()
RETURNS TABLE(today_start timestamptz, today_end timestamptz)
LANGUAGE plpgsql
AS $$
DECLARE
  est_today_start timestamptz;
  est_today_end timestamptz;
BEGIN
  -- Get today's date range in EST timezone
  est_today_start := date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York';
  est_today_end := est_today_start + interval '1 day';
  
  RETURN QUERY SELECT est_today_start, est_today_end;
END;
$$;

-- Step 2: Ensure update function exists with EST timezone
CREATE OR REPLACE FUNCTION update_live_call_boardt_stats_for_agent(p_agent_email text)
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
  -- Get today's date range in EST timezone, then convert to UTC for querying
  -- This ensures "today" is calculated based on EST day boundaries, not UTC
  today_start := date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York';
  today_end := today_start + interval '1 day';
  
  -- Get counts for this agent today - CALCULATE ALL METRICS AT ONCE
  -- CRITICAL: Each phone number counts ONCE per event type per agent per day (DISTINCT ensures no duplicates)
  --   - DIALS: Count distinct phones where event_type = 'dial'
  --   - REACHES: Count distinct phones where call_status = 'completed' AND event_type = 'dial'
  --   - BOOKED: Count distinct phones where event_type = 'booked' OR disposition = 'booked'
  SELECT 
    -- DIALED: Distinct phones only (filters duplicates)
    COUNT(DISTINCT CASE WHEN LOWER(event_type) = 'dial' THEN lead_phone END) as dialed,
    -- REACHED: Distinct phones only where call_status = 'completed' (filters duplicates)
    COUNT(DISTINCT CASE WHEN LOWER(COALESCE(call_status, '')) = 'completed' AND LOWER(event_type) = 'dial' THEN lead_phone END) as reached,
    -- BOOKED: Distinct phones only where booked (filters duplicates)
    COUNT(DISTINCT CASE WHEN (LOWER(event_type) = 'booked' OR LOWER(COALESCE(disposition, '')) = 'booked') THEN lead_phone END) as booked
  INTO dialed_count, reached_count, booked_count
  FROM agent_dial_metrics
  WHERE agent_email = p_agent_email
    AND event_timestamp >= today_start
    AND event_timestamp < today_end
    AND lead_phone IS NOT NULL;
  
  -- Update live_call_boardt (create row if it doesn't exist)
  INSERT INTO live_call_boardt (
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
    -- Always update to the calculated value - no limits, no GREATEST
    today_dialed = dialed_count,
    today_reached = reached_count,
    today_booked = booked_count,
    updated_at = now();
  
END;
$$;

-- Step 3: Ensure trigger function exists
CREATE OR REPLACE FUNCTION trigger_update_live_call_boardt_on_metric()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update stats for this agent when a new metric is inserted
  IF NEW.agent_email IS NOT NULL AND NEW.agent_email != '' THEN
    PERFORM update_live_call_boardt_stats_for_agent(NEW.agent_email);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Step 4: Drop old triggers (if they exist)
DROP TRIGGER IF EXISTS trigger_update_live_call_board_on_metric_insert ON agent_dial_metrics;
DROP TRIGGER IF EXISTS trigger_update_live_call_board_on_metric ON agent_dial_metrics;
DROP TRIGGER IF EXISTS trigger_update_live_call_board_stats ON agent_dial_metrics;
DROP TRIGGER IF EXISTS trigger_update_live_call_boardt_on_metric_insert ON agent_dial_metrics;
DROP TRIGGER IF EXISTS trigger_update_live_call_board_on_metric_update ON agent_dial_metrics;
DROP TRIGGER IF EXISTS trigger_update_live_call_boardt_on_metric_update ON agent_dial_metrics;

-- Step 5: Create INSERT trigger
CREATE TRIGGER trigger_update_live_call_boardt_on_metric_insert
  AFTER INSERT ON agent_dial_metrics
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_live_call_boardt_on_metric();

-- Step 6: Create UPDATE trigger
-- CRITICAL: Must watch call_status because it's updated AFTER the initial INSERT (when dial happens)
-- When call_status changes from NULL to 'completed', we need to recalculate reached count
CREATE TRIGGER trigger_update_live_call_boardt_on_metric_update
  AFTER UPDATE OF event_type, agent_email, event_timestamp, call_status, disposition ON agent_dial_metrics
  FOR EACH ROW
  WHEN (OLD.event_type IS DISTINCT FROM NEW.event_type 
        OR OLD.agent_email IS DISTINCT FROM NEW.agent_email
        OR date_trunc('day', OLD.event_timestamp) IS DISTINCT FROM date_trunc('day', NEW.event_timestamp)
        OR OLD.call_status IS DISTINCT FROM NEW.call_status
        OR OLD.disposition IS DISTINCT FROM NEW.disposition)
  EXECUTE FUNCTION trigger_update_live_call_boardt_on_metric();

-- Step 7: Ensure triggers are ENABLED
ALTER TABLE agent_dial_metrics ENABLE TRIGGER trigger_update_live_call_boardt_on_metric_insert;
ALTER TABLE agent_dial_metrics ENABLE TRIGGER trigger_update_live_call_boardt_on_metric_update;

-- Step 8: Verify triggers are set up
DO $$
DECLARE
  trigger_count integer;
BEGIN
  SELECT COUNT(*) INTO trigger_count
  FROM pg_trigger
  WHERE tgrelid = 'agent_dial_metrics'::regclass
    AND tgname LIKE '%live_call_boardt%';
  
  IF trigger_count >= 2 THEN
    RAISE NOTICE '✅ SUCCESS: % triggers found and enabled', trigger_count;
  ELSE
    RAISE WARNING '❌ ERROR: Only % triggers found (expected 2)', trigger_count;
  END IF;
END $$;

-- Step 9: Test the trigger function with a sample agent (optional - uncomment to test)
-- SELECT update_live_call_boardt_stats_for_agent('your-agent-email@example.com');

