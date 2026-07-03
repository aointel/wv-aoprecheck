-- ============================================================================
-- COMPLETE AUTO-SETUP FOR LIVE CALL BOARD UPDATES
-- This script sets up EVERYTHING so you never have to run SQL manually again
-- Run this ONCE and forget about it
-- ============================================================================

-- Step 1: Drop and recreate the main function with FIXED logic
DROP FUNCTION IF EXISTS update_live_call_boardt_stats_from_metrics() CASCADE;

CREATE OR REPLACE FUNCTION update_live_call_boardt_stats_from_metrics()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  today_start timestamptz;
  today_end timestamptz;
BEGIN
  -- Get today's date range in EST timezone
  today_start := date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York';
  today_end := today_start + interval '1 day';
  
  -- Update live_call_boardt with today's stats
  -- DIALED: From twilio_call_logs (outbound calls with duration >= 15s, DISTINCT by to_number)
  -- REACHED: From agent_dial_metrics (event_type = 'reach') - FIXED
  -- BOOKED: From agent_dial_metrics (event_type = 'booked' OR disposition = 'booked') - FIXED
  INSERT INTO live_call_boardt (
    agent_email,
    status,
    today_dialed,
    today_reached,
    today_booked,
    today_instant_presentation,
    updated_at
  )
  SELECT 
    COALESCE(dialed_stats.agent_email, metrics_stats.agent_email) as agent_email,
    'offline' as status,
    COALESCE(dialed_stats.dialed, 0) as dialed,
    COALESCE(metrics_stats.reached, 0) as reached,
    COALESCE(metrics_stats.booked, 0) as booked,
    COALESCE(metrics_stats.instant_presentation, 0) as instant_presentation,
    now() as updated_at
  FROM (
    -- DIALED: Count distinct phone numbers from twilio_call_logs (only calls with duration >= 15s)
    SELECT 
      tcl.owner_email as agent_email,
      COUNT(DISTINCT tcl.to_number) as dialed
    FROM (
      SELECT DISTINCT ON (owner_email, to_number)
        owner_email,
        to_number,
        call_direction,
        call_duration,
        call_status
      FROM twilio_call_logs
      WHERE call_started_at >= today_start
        AND call_started_at < today_end
        AND owner_email IS NOT NULL
        AND owner_email != ''
        AND call_direction = 'outbound'
        AND call_duration IS NOT NULL
        AND call_duration >= 15
        AND to_number IS NOT NULL
        AND to_number != ''
        AND LOWER(COALESCE(call_status, '')) NOT IN ('failed', 'busy', 'no-answer', 'canceled')
      ORDER BY owner_email, to_number, call_started_at DESC
    ) tcl
    GROUP BY tcl.owner_email
  ) dialed_stats
  FULL OUTER JOIN (
    -- REACHED/BOOKED/INSTANT_PRESENTATION: From agent_dial_metrics (where events are actually logged)
    SELECT
      adm.agent_email,
      -- REACHED: Count distinct phones where event_type = 'reach'
      COUNT(DISTINCT CASE 
        WHEN LOWER(adm.event_type) = 'reach'
        THEN adm.lead_phone 
      END) as reached,
      -- BOOKED: Count distinct phones where event_type = 'booked' ONLY (not disposition!)
      -- CRITICAL: Only count event_type='booked', NOT disposition='booked' on dial/reach events
      COUNT(DISTINCT CASE 
        WHEN (LOWER(adm.event_type) = 'booked' 
              OR LOWER(adm.event_type) = 'instant_presentation')
        THEN adm.lead_phone 
      END) as booked,
      -- INSTANT_PRESENTATION: Count distinct phones where event_type = 'instant_presentation'
      COUNT(DISTINCT CASE 
        WHEN (LOWER(adm.event_type) = 'instant_presentation' 
              OR LOWER(COALESCE(adm.disposition, '')) = 'instant_presentation')
        THEN adm.lead_phone 
      END) as instant_presentation
    FROM agent_dial_metrics adm
    WHERE adm.event_timestamp >= today_start
      AND adm.event_timestamp < today_end
      AND adm.agent_email IS NOT NULL
      AND adm.agent_email != ''
      AND adm.lead_phone IS NOT NULL
    GROUP BY adm.agent_email
  ) metrics_stats ON dialed_stats.agent_email = metrics_stats.agent_email
  WHERE COALESCE(dialed_stats.agent_email, metrics_stats.agent_email) IS NOT NULL
  ON CONFLICT (agent_email) 
  DO UPDATE SET
    today_dialed = EXCLUDED.today_dialed,
    today_reached = EXCLUDED.today_reached,
    today_booked = EXCLUDED.today_booked,
    today_instant_presentation = EXCLUDED.today_instant_presentation,
    updated_at = EXCLUDED.updated_at;
END;
$$;

-- Step 2: Drop and recreate the single-agent function
DROP FUNCTION IF EXISTS update_live_call_boardt_stats_for_agent(text) CASCADE;

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
  instant_presentation_count integer;
BEGIN
  today_start := date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York';
  today_end := today_start + interval '1 day';
  
  -- DIALED: From twilio_call_logs
  SELECT COUNT(DISTINCT tcl.to_number)
  INTO dialed_count
  FROM twilio_call_logs tcl
  WHERE tcl.owner_email = p_agent_email
    AND tcl.call_started_at >= today_start
    AND tcl.call_started_at < today_end
    AND tcl.call_direction = 'outbound'
    AND tcl.call_duration IS NOT NULL
    AND tcl.call_duration >= 15
    AND tcl.to_number IS NOT NULL
    AND tcl.to_number != ''
    AND LOWER(COALESCE(tcl.call_status, '')) NOT IN ('failed', 'busy', 'no-answer', 'canceled');
  
  -- REACHED/BOOKED/INSTANT_PRESENTATION: From agent_dial_metrics
  SELECT
    COUNT(DISTINCT CASE WHEN LOWER(adm.event_type) = 'reach' THEN adm.lead_phone END) as reached,
    -- BOOKED: Only count event_type='booked', NOT disposition='booked' on dial/reach events
    COUNT(DISTINCT CASE 
      WHEN (LOWER(adm.event_type) = 'booked' 
            OR LOWER(adm.event_type) = 'instant_presentation')
      THEN adm.lead_phone 
    END) as booked,
    COUNT(DISTINCT CASE 
      WHEN LOWER(adm.event_type) = 'instant_presentation'
      THEN adm.lead_phone 
    END) as instant_presentation
  INTO reached_count, booked_count, instant_presentation_count
  FROM agent_dial_metrics adm
  WHERE adm.agent_email = p_agent_email
    AND adm.event_timestamp >= today_start
    AND adm.event_timestamp < today_end
    AND adm.lead_phone IS NOT NULL;
  
  INSERT INTO live_call_boardt (
    agent_email,
    status,
    today_dialed,
    today_reached,
    today_booked,
    today_instant_presentation,
    updated_at
  )
  VALUES (
    p_agent_email,
    'offline',
    COALESCE(dialed_count, 0),
    COALESCE(reached_count, 0),
    COALESCE(booked_count, 0),
    COALESCE(instant_presentation_count, 0),
    now()
  )
  ON CONFLICT (agent_email) 
  DO UPDATE SET
    today_dialed = dialed_count,
    today_reached = reached_count,
    today_booked = booked_count,
    today_instant_presentation = instant_presentation_count,
    updated_at = now();
END;
$$;

-- Step 3: Create/update trigger function
CREATE OR REPLACE FUNCTION trigger_update_live_call_boardt_on_metric()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update stats for this agent when a new metric is inserted/updated
  IF NEW.agent_email IS NOT NULL AND NEW.agent_email != '' THEN
    PERFORM update_live_call_boardt_stats_for_agent(NEW.agent_email);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Step 4: Drop old triggers and create new ones (ENSURE THEY'RE ENABLED)
DROP TRIGGER IF EXISTS trigger_update_live_call_board_on_metric_insert ON agent_dial_metrics;
DROP TRIGGER IF EXISTS trigger_update_live_call_board_on_metric ON agent_dial_metrics;
DROP TRIGGER IF EXISTS trigger_update_live_call_board_stats ON agent_dial_metrics;
DROP TRIGGER IF EXISTS trigger_update_live_call_boardt_on_metric_insert ON agent_dial_metrics;
DROP TRIGGER IF EXISTS trigger_update_live_call_board_on_metric_update ON agent_dial_metrics;
DROP TRIGGER IF EXISTS trigger_update_live_call_boardt_on_metric_update ON agent_dial_metrics;

-- Create INSERT trigger (fires immediately when new metric is inserted)
CREATE TRIGGER trigger_update_live_call_boardt_on_metric_insert
  AFTER INSERT ON agent_dial_metrics
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_live_call_boardt_on_metric();

-- Create UPDATE trigger (fires when event_type, call_status, or disposition changes)
CREATE TRIGGER trigger_update_live_call_boardt_on_metric_update
  AFTER UPDATE OF event_type, agent_email, event_timestamp, call_status, disposition ON agent_dial_metrics
  FOR EACH ROW
  WHEN (OLD.event_type IS DISTINCT FROM NEW.event_type 
        OR OLD.agent_email IS DISTINCT FROM NEW.agent_email
        OR date_trunc('day', OLD.event_timestamp) IS DISTINCT FROM date_trunc('day', NEW.event_timestamp)
        OR OLD.call_status IS DISTINCT FROM NEW.call_status
        OR OLD.disposition IS DISTINCT FROM NEW.disposition)
  EXECUTE FUNCTION trigger_update_live_call_boardt_on_metric();

-- Step 5: ENSURE TRIGGERS ARE ENABLED (critical!)
ALTER TABLE agent_dial_metrics ENABLE TRIGGER trigger_update_live_call_boardt_on_metric_insert;
ALTER TABLE agent_dial_metrics ENABLE TRIGGER trigger_update_live_call_boardt_on_metric_update;

-- Step 6: Run initial update to sync all current stats
SELECT update_live_call_boardt_stats_from_metrics();

-- Step 7: Verify everything is set up correctly
DO $$
DECLARE
  insert_trigger_exists boolean;
  update_trigger_exists boolean;
  insert_trigger_enabled boolean;
  update_trigger_enabled boolean;
BEGIN
  -- Check INSERT trigger
  SELECT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trigger_update_live_call_boardt_on_metric_insert'
  ) INTO insert_trigger_exists;
  
  SELECT tgenabled = 'O' 
  FROM pg_trigger 
  WHERE tgname = 'trigger_update_live_call_boardt_on_metric_insert'
  INTO insert_trigger_enabled;
  
  -- Check UPDATE trigger
  SELECT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trigger_update_live_call_boardt_on_metric_update'
  ) INTO update_trigger_exists;
  
  SELECT tgenabled = 'O' 
  FROM pg_trigger 
  WHERE tgname = 'trigger_update_live_call_boardt_on_metric_update'
  INTO update_trigger_enabled;
  
  -- Report status
  IF insert_trigger_exists AND insert_trigger_enabled THEN
    RAISE NOTICE '✅ INSERT trigger exists and is ENABLED';
  ELSE
    RAISE WARNING '❌ INSERT trigger MISSING or DISABLED!';
  END IF;
  
  IF update_trigger_exists AND update_trigger_enabled THEN
    RAISE NOTICE '✅ UPDATE trigger exists and is ENABLED';
  ELSE
    RAISE WARNING '❌ UPDATE trigger MISSING or DISABLED!';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ SETUP COMPLETE!';
  RAISE NOTICE '';
  RAISE NOTICE 'The live call board will now update automatically:';
  RAISE NOTICE '  1. Database triggers update stats immediately when agent_dial_metrics change';
  RAISE NOTICE '  2. Node.js scheduler runs every 30 seconds as backup (server/live-call-board-stats-scheduler.ts)';
  RAISE NOTICE '';
  RAISE NOTICE 'You should NEVER need to run SQL manually again!';
END $$;
