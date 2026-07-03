-- UPDATE LIVE_CALL_BOARD FROM TWILIO_CALL_LOGS, MASTERLEAD, AND AGENT_DIAL_METRICS
-- DIALED: Counted from twilio_call_logs (outbound calls with duration >= 1s OR answered, DISTINCT by to_number/phone number, excludes failed/busy/no-answer)
-- REACHED: Counted from twilio_call_logs (outbound calls with duration >= 50s, status = 'answered'/'completed', DISTINCT by call_sid)
-- INSTANT_PRESENTATION: Counted from agent_dial_metrics (event_type = 'instant_presentation', requires call duration > 900s/15 minutes)
-- BOOKED: Counted from agent_dial_metrics ONLY (includes 'booked' and 'instant_presentation', duration > 240s)
-- CRITICAL: All counts use DISTINCT ON (twilio_call_sid) to prevent duplicate counting
-- CRITICAL: Only outbound calls are counted (call_direction = 'outbound')
-- This is the source of truth for dial/reach/booked metrics
--
-- HOW IT WORKS:
-- 1. Application code now calculates counts and updates live_call_boardt directly
-- 2. The function update_live_call_boardt_stats_from_metrics() can be run periodically to sync all agents
-- 3. Stats are calculated for "today" based on EST timezone (America/New_York)
--
-- USAGE:
-- - Application code updates counts after logging metrics (no SQL triggers needed)
-- - To sync all agents manually: SELECT update_live_call_boardt_stats_from_metrics();
-- - To set up periodic sync (e.g., every minute): Use Supabase cron or pg_cron extension
--
-- NOTE: This assumes rows already exist in live_call_boardt for agents.
-- If rows don't exist, they will only be created if agent has metrics today (via INSERT ... ON CONFLICT)

-- Helper function to get today's EST date range (for application code)
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

-- Function to update live_call_boardt stats - DIALED/REACHED from twilio_call_logs, INSTANT_PRESENTATION from agent_dial_metrics, BOOKED from agent_dial_metrics
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
  -- DIALED: From twilio_call_logs (outbound calls with duration >= 1s OR answered, DISTINCT by to_number/phone number, excludes failed/busy/no-answer)
  -- REACHED: From twilio_call_logs (outbound calls with duration >= 50s, status = 'answered'/'completed', DISTINCT by call_sid)
  -- INSTANT_PRESENTATION: From agent_dial_metrics (event_type = 'instant_presentation', requires call duration > 900s/15 minutes)
  -- BOOKED: From agent_dial_metrics ONLY (includes 'booked' and 'instant_presentation')
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
    COALESCE(dialed_stats.agent_email, reached_stats.agent_email, instant_presentation_stats.agent_email, booked_stats.agent_email) as agent_email,
    'offline' as status,
    COALESCE(dialed_stats.dialed, 0) as dialed,
    COALESCE(reached_stats.reached, 0) as reached,
    COALESCE(booked_stats.booked, 0) as booked,
    COALESCE(instant_presentation_stats.instant_presentation, 0) as instant_presentation,
    now() as updated_at
  FROM (
    -- DIALED: Count distinct phone numbers from twilio_call_logs (duration >= 1s OR answered)
    -- CRITICAL: Count DISTINCT to_number (unique phone numbers), not call_sids
    -- CRITICAL: Only count outbound calls with valid to_number (skip parent WebRTC calls)
    -- CRITICAL: Count as dial if: (duration >= 1) OR (status = 'answered' or 'completed')
    -- CRITICAL: Exclude failed/busy/no-answer/canceled (unless answered)
    SELECT 
      tcl.owner_email as agent_email,
      COUNT(DISTINCT tcl.to_number) as dialed
    FROM (
      -- First, get distinct phone numbers to prevent any duplicate counting
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
        AND call_direction = 'outbound'  -- ONLY count outbound calls
        AND to_number IS NOT NULL
        AND to_number != ''  -- Skip parent WebRTC calls (they have no to_number)
        AND (
          (call_duration IS NOT NULL AND call_duration >= 1)
          OR LOWER(COALESCE(call_status, '')) IN ('answered', 'completed')
        )
        AND NOT (
          LOWER(COALESCE(call_status, '')) IN ('failed', 'busy', 'no-answer', 'canceled')
          AND LOWER(COALESCE(call_status, '')) NOT IN ('answered', 'completed')
        )
      ORDER BY owner_email, to_number, call_started_at DESC  -- Get most recent if duplicates exist
    ) tcl
    GROUP BY tcl.owner_email
  ) dialed_stats
  FULL OUTER JOIN (
    -- REACHED: From twilio_call_logs
    -- CRITICAL: Use DISTINCT on twilio_call_sid to prevent duplicates
    -- CRITICAL: Only count outbound calls that actually connected (duration >= 50s, status = answered/completed)
    SELECT 
      tcl.owner_email as agent_email,
      COUNT(DISTINCT tcl.twilio_call_sid) as reached
    FROM (
      -- First, get distinct call_sids to prevent any duplicate counting
      SELECT DISTINCT ON (twilio_call_sid)
        twilio_call_sid,
        owner_email,
        call_direction,
        to_number,
        call_duration,
        call_status
      FROM twilio_call_logs
      WHERE call_started_at >= today_start
        AND call_started_at < today_end
        AND owner_email IS NOT NULL
        AND owner_email != ''
        AND call_direction = 'outbound'  -- ONLY count outbound calls
        AND call_duration IS NOT NULL
        AND call_duration >= 50
        AND LOWER(COALESCE(call_status, '')) IN ('answered', 'completed')
        AND to_number IS NOT NULL
        AND to_number != ''
      ORDER BY twilio_call_sid, call_started_at DESC  -- Get most recent if duplicates exist
    ) tcl
    GROUP BY tcl.owner_email
  ) reached_stats ON dialed_stats.agent_email = reached_stats.agent_email
  FULL OUTER JOIN (
    -- INSTANT_PRESENTATION: From agent_dial_metrics (event_type = 'instant_presentation')
    -- CRITICAL: Only count if call duration is over 15 minutes (900 seconds)
    SELECT
      adm.agent_email,
      COUNT(DISTINCT adm.lead_phone) as instant_presentation
    FROM agent_dial_metrics adm
    LEFT JOIN twilio_call_logs tcl ON adm.call_sid = tcl.twilio_call_sid
    WHERE adm.event_timestamp >= today_start
      AND adm.event_timestamp < today_end
      AND adm.agent_email IS NOT NULL
      AND adm.agent_email != ''
      AND adm.lead_phone IS NOT NULL
      AND (
        LOWER(adm.event_type) = 'instant_presentation'
        OR LOWER(COALESCE(adm.disposition, '')) = 'instant_presentation'
      )
      AND COALESCE(tcl.call_duration, adm.call_duration, 0) > 900  -- Only count if duration is over 15 minutes
    GROUP BY adm.agent_email
  ) instant_presentation_stats ON dialed_stats.agent_email = instant_presentation_stats.agent_email
  FULL OUTER JOIN (
    -- BOOKED: ONLY from agent_dial_metrics (includes 'booked' and 'instant_presentation')
    SELECT
      adm.agent_email,
      COUNT(DISTINCT adm.lead_phone) as booked
    FROM agent_dial_metrics adm
    LEFT JOIN twilio_call_logs tcl ON adm.call_sid = tcl.twilio_call_sid
    WHERE adm.event_timestamp >= today_start
      AND adm.event_timestamp < today_end
      AND adm.agent_email IS NOT NULL
      AND adm.agent_email != ''
      AND adm.lead_phone IS NOT NULL
      AND (
        LOWER(adm.event_type) = 'booked' 
        OR LOWER(COALESCE(adm.disposition, '')) = 'booked'
        OR LOWER(adm.event_type) = 'instant_presentation'
        OR LOWER(COALESCE(adm.disposition, '')) = 'instant_presentation'
      )
      AND COALESCE(tcl.call_duration, adm.call_duration, 0) > 240
    GROUP BY adm.agent_email
  ) booked_stats ON dialed_stats.agent_email = booked_stats.agent_email
  WHERE COALESCE(dialed_stats.agent_email, reached_stats.agent_email, instant_presentation_stats.agent_email, booked_stats.agent_email) IS NOT NULL
  ON CONFLICT (agent_email) 
  DO UPDATE SET
    today_dialed = EXCLUDED.today_dialed,
    today_reached = EXCLUDED.today_reached,
    today_booked = EXCLUDED.today_booked,
    today_instant_presentation = EXCLUDED.today_instant_presentation,
    updated_at = EXCLUDED.updated_at;
  
  -- REMOVED: Aggressive reset logic that was clearing stats to 0
  -- This was causing stats to be reset incorrectly when the function ran
  -- Stats will only be updated for agents who have metrics today
  -- Agents without metrics today will keep their existing stats (won't be reset to 0)
  
END;
$$;

-- Function to update stats for a specific agent (called when new metric is inserted)
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
  -- Get today's date range in EST timezone, then convert to UTC for querying
  -- This ensures "today" is calculated based on EST day boundaries, not UTC
  today_start := date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York';
  today_end := today_start + interval '1 day';
  
  -- Get counts for this agent today - CALCULATE ALL METRICS AT ONCE
  -- CRITICAL: Each phone number/call counts ONCE per event type per agent per day (DISTINCT ensures no duplicates)
  --   - DIALED: Count distinct calls from twilio_call_logs (calls with duration > 0, skip parent WebRTC calls)
  --   - REACHED: Count distinct calls from twilio_call_logs (calls with duration >= 50s, status = 'answered'/'completed')
  --   - INSTANT_PRESENTATION: Count distinct phones from agent_dial_metrics (event_type = 'instant_presentation', duration > 900s)
  --   - BOOKED: Count distinct phones from agent_dial_metrics ONLY (includes 'booked' and 'instant_presentation', duration > 240s)
  SELECT 
    -- DIALED: Count distinct phone numbers from twilio_call_logs (duration >= 1s OR answered)
    -- CRITICAL: Count DISTINCT to_number (unique phone numbers), not call_sids
    -- CRITICAL: Count as dial if: (duration >= 1) OR (status = 'answered' or 'completed')
    -- CRITICAL: Exclude failed/busy/no-answer/canceled (unless answered)
    COALESCE((
      SELECT COUNT(DISTINCT tcl2.to_number)
      FROM twilio_call_logs tcl2
      WHERE tcl2.owner_email = p_agent_email
        AND tcl2.call_started_at >= today_start
        AND tcl2.call_started_at < today_end
        AND tcl2.call_direction = 'outbound'  -- ONLY count outbound calls
        AND tcl2.to_number IS NOT NULL
        AND tcl2.to_number != ''
        AND (
          (tcl2.call_duration IS NOT NULL AND tcl2.call_duration >= 1)
          OR LOWER(COALESCE(tcl2.call_status, '')) IN ('answered', 'completed')
        )
        AND NOT (
          LOWER(COALESCE(tcl2.call_status, '')) IN ('failed', 'busy', 'no-answer', 'canceled')
          AND LOWER(COALESCE(tcl2.call_status, '')) NOT IN ('answered', 'completed')
        )
    ), 0) as dialed,
    -- REACHED: From twilio_call_logs (calls with duration >= 50s, status = 'answered'/'completed')
    -- CRITICAL: Use DISTINCT to prevent duplicates, only count outbound calls
    COALESCE((
      SELECT COUNT(DISTINCT tcl2.twilio_call_sid)
      FROM twilio_call_logs tcl2
      WHERE tcl2.owner_email = p_agent_email
        AND tcl2.call_started_at >= today_start
        AND tcl2.call_started_at < today_end
        AND tcl2.call_direction = 'outbound'  -- ONLY count outbound calls
        AND tcl2.call_duration IS NOT NULL
        AND tcl2.call_duration >= 50
        AND LOWER(COALESCE(tcl2.call_status, '')) IN ('answered', 'completed')
        AND tcl2.to_number IS NOT NULL
        AND tcl2.to_number != ''
    ), 0) as reached,
    -- BOOKED: ONLY from agent_dial_metrics (includes 'booked' and 'instant_presentation')
    COALESCE((
      SELECT COUNT(DISTINCT adm2.lead_phone)
      FROM agent_dial_metrics adm2
      LEFT JOIN twilio_call_logs tcl2 ON adm2.call_sid = tcl2.twilio_call_sid
      WHERE adm2.agent_email = p_agent_email
        AND adm2.event_timestamp >= today_start
        AND adm2.event_timestamp < today_end
        AND (
          LOWER(adm2.event_type) = 'booked' 
          OR LOWER(COALESCE(adm2.disposition, '')) = 'booked'
          OR LOWER(adm2.event_type) = 'instant_presentation'
          OR LOWER(COALESCE(adm2.disposition, '')) = 'instant_presentation'
        )
        AND COALESCE(tcl2.call_duration, adm2.call_duration, 0) > 240
    ), 0) as booked,
    -- INSTANT_PRESENTATION: From agent_dial_metrics (event_type = 'instant_presentation')
    -- CRITICAL: Only count if call duration is over 15 minutes (900 seconds)
    -- If event_type is already 'instant_presentation', we trust it was created correctly
    COALESCE((
      SELECT COUNT(DISTINCT adm2.lead_phone)
      FROM agent_dial_metrics adm2
      LEFT JOIN twilio_call_logs tcl2 ON adm2.call_sid = tcl2.twilio_call_sid
      WHERE adm2.agent_email = p_agent_email
        AND adm2.event_timestamp >= today_start
        AND adm2.event_timestamp < today_end
        AND (
          LOWER(adm2.event_type) = 'instant_presentation'
          OR LOWER(COALESCE(adm2.disposition, '')) = 'instant_presentation'
        )
        AND (
          -- If event_type is 'instant_presentation', trust it (was created from calls > 900s)
          LOWER(adm2.event_type) = 'instant_presentation'
          -- OR verify duration is over 15 minutes
          OR COALESCE(tcl2.call_duration, adm2.call_duration, 0) > 900
        )
    ), 0) as instant_presentation
  INTO dialed_count, reached_count, booked_count, instant_presentation_count
  FROM (SELECT 1) dummy;
  
  -- Update live_call_boardt (create row if it doesn't exist)
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
    -- Always update to the calculated value - no limits, no GREATEST
    today_dialed = dialed_count,
    today_reached = reached_count,
    today_booked = booked_count,
    today_instant_presentation = instant_presentation_count,
    updated_at = now();
  
END;
$$;

-- Trigger function to update stats when new metric is inserted
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

-- Create trigger on agent_dial_metrics insert
-- Drop ALL possible old trigger names (both old and new naming)
DROP TRIGGER IF EXISTS trigger_update_live_call_board_on_metric_insert ON agent_dial_metrics;
DROP TRIGGER IF EXISTS trigger_update_live_call_board_on_metric ON agent_dial_metrics;
DROP TRIGGER IF EXISTS trigger_update_live_call_board_stats ON agent_dial_metrics;
DROP TRIGGER IF EXISTS trigger_update_live_call_boardt_on_metric_insert ON agent_dial_metrics;
DROP TRIGGER IF EXISTS trigger_update_live_call_board_on_metric_update ON agent_dial_metrics;
DROP TRIGGER IF EXISTS trigger_update_live_call_boardt_on_metric_update ON agent_dial_metrics;
-- Drop the old function that references wrong table
DROP FUNCTION IF EXISTS update_live_call_board_stats_for_agent(text);
DROP FUNCTION IF EXISTS trigger_update_live_call_board_on_metric();
-- Now create the new trigger
CREATE TRIGGER trigger_update_live_call_boardt_on_metric_insert
  AFTER INSERT ON agent_dial_metrics
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_live_call_boardt_on_metric();

-- Create trigger on agent_dial_metrics update (in case event_type, call_status, or disposition changes)
-- CRITICAL: Must watch call_status because it's updated AFTER the initial INSERT (when dial happens)
-- When call_status changes from NULL to 'answered' or 'completed', we need to recalculate reached count
DROP TRIGGER IF EXISTS trigger_update_live_call_boardt_on_metric_update ON agent_dial_metrics;
CREATE TRIGGER trigger_update_live_call_boardt_on_metric_update
  AFTER UPDATE OF event_type, agent_email, event_timestamp, call_status, disposition ON agent_dial_metrics
  FOR EACH ROW
  WHEN (OLD.event_type IS DISTINCT FROM NEW.event_type 
        OR OLD.agent_email IS DISTINCT FROM NEW.agent_email
        OR date_trunc('day', OLD.event_timestamp) IS DISTINCT FROM date_trunc('day', NEW.event_timestamp)
        OR OLD.call_status IS DISTINCT FROM NEW.call_status
        OR OLD.disposition IS DISTINCT FROM NEW.disposition)
  EXECUTE FUNCTION trigger_update_live_call_boardt_on_metric();

-- Comment on functions
COMMENT ON FUNCTION update_live_call_boardt_stats_from_metrics() IS 'Updates all agents'' stats: DIALED/REACHED from twilio_call_logs, INSTANT_PRESENTATION from agent_dial_metrics, BOOKED from agent_dial_metrics (includes booked and instant_presentation). Run periodically (e.g., every 30 seconds) to keep stats current.';
COMMENT ON FUNCTION update_live_call_boardt_stats_for_agent(text) IS 'Updates a specific agent''s today stats: DIALED/REACHED from twilio_call_logs, INSTANT_PRESENTATION from agent_dial_metrics, BOOKED from agent_dial_metrics (includes booked and instant_presentation). Called by trigger when new metric is inserted.';
COMMENT ON FUNCTION trigger_update_live_call_boardt_on_metric() IS 'Trigger function that updates live_call_boardt stats when agent_dial_metrics is inserted/updated.';

-- Run initial update to sync existing data
-- (Uncomment if you want to run this immediately)
-- SELECT update_live_call_boardt_stats_from_metrics();

-- ============================================================================
-- SETUP AUTOMATIC UPDATES
-- ============================================================================
-- The live call board is updated through multiple layers:
-- 1. Database triggers (real-time) - updates when agent_dial_metrics change
-- 2. Node.js scheduler (primary) - runs every 30 seconds via server/live-call-board-stats-scheduler.ts
-- 3. Database cron job (backup) - run setup-live-call-board-auto-update.sql to enable
--
-- To ensure continuous updates:
-- - Triggers are automatically created above
-- - Node.js scheduler starts automatically when server starts (server/index.ts)
-- - Database cron job can be set up as backup (see setup-live-call-board-auto-update.sql)
-- ============================================================================

-- ============================================================================
-- BACKFILL SCRIPT: Recalculate all live_call_boardt stats with corrected logic
-- This fixes historical data to use:
-- 1. DISTINCT phone numbers for reached/booked (each number counts once)
-- 2. Only "booked" disposition counts as booked (not other dispositions)
-- ============================================================================

-- Function to backfill all agents' stats for today with corrected logic
CREATE OR REPLACE FUNCTION backfill_live_call_boardt_stats_corrected()
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
  
  -- Step 1: Update all existing agents with corrected stats
  -- CRITICAL: Use DISTINCT phone numbers for reached/booked (each number counts once)
  -- CRITICAL: Booked counts when disposition = 'booked' OR 'instant_presentation'
  UPDATE live_call_boardt lcb
  SET 
    today_dialed = COALESCE(stats.new_dialed, 0),
    today_reached = COALESCE(stats.new_reached, 0),
    today_booked = COALESCE(stats.new_booked, 0),
    today_instant_presentation = COALESCE(stats.new_instant_presentation, 0),
    updated_at = now()
  FROM (
    SELECT
      COALESCE(dialed_stats.agent_email, reached_stats.agent_email, instant_presentation_stats.agent_email, booked_stats.agent_email) as agent_email,
      COALESCE(dialed_stats.new_dialed, 0) as new_dialed,
      COALESCE(reached_stats.new_reached, 0) as new_reached,
      COALESCE(booked_stats.new_booked, 0) as new_booked,
      COALESCE(instant_presentation_stats.new_instant_presentation, 0) as new_instant_presentation
    FROM (
      -- DIALED: Count distinct phone numbers from twilio_call_logs (duration >= 1s OR answered)
      -- CRITICAL: Count DISTINCT to_number (unique phone numbers), not call_sids
      -- CRITICAL: Only count outbound calls with valid to_number (skip parent WebRTC calls)
      -- CRITICAL: Count as dial if: (duration >= 1) OR (status = 'answered' or 'completed')
      -- CRITICAL: Exclude failed/busy/no-answer/canceled (unless answered)
      SELECT 
        tcl.owner_email as agent_email,
        COUNT(DISTINCT tcl.to_number) as new_dialed
      FROM (
        -- First, get distinct phone numbers to prevent any duplicate counting
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
          AND call_direction = 'outbound'  -- ONLY count outbound calls
          AND to_number IS NOT NULL
          AND to_number != ''
          AND (
            (call_duration IS NOT NULL AND call_duration >= 1)
            OR LOWER(COALESCE(call_status, '')) IN ('answered', 'completed')
          )
          AND NOT (
            LOWER(COALESCE(call_status, '')) IN ('failed', 'busy', 'no-answer', 'canceled')
            AND LOWER(COALESCE(call_status, '')) NOT IN ('answered', 'completed')
          )
        ORDER BY owner_email, to_number, call_started_at DESC  -- Get most recent if duplicates exist
      ) tcl
      GROUP BY tcl.owner_email
    ) dialed_stats
    FULL OUTER JOIN (
      -- REACHED: From twilio_call_logs
      -- CRITICAL: Use DISTINCT on twilio_call_sid to prevent duplicates
      -- CRITICAL: Only count outbound calls that actually connected (duration >= 50s, status = answered/completed)
      SELECT 
        tcl.owner_email as agent_email,
        COUNT(DISTINCT tcl.twilio_call_sid) as new_reached
      FROM (
        -- First, get distinct call_sids to prevent any duplicate counting
        SELECT DISTINCT ON (twilio_call_sid)
          twilio_call_sid,
          owner_email,
          call_direction,
          to_number,
          call_duration,
          call_status
        FROM twilio_call_logs
        WHERE call_started_at >= today_start
          AND call_started_at < today_end
          AND owner_email IS NOT NULL
          AND owner_email != ''
          AND call_direction = 'outbound'  -- ONLY count outbound calls
          AND call_duration IS NOT NULL
          AND call_duration >= 50
          AND LOWER(COALESCE(call_status, '')) IN ('answered', 'completed')
          AND to_number IS NOT NULL
          AND to_number != ''
        ORDER BY twilio_call_sid, call_started_at DESC  -- Get most recent if duplicates exist
      ) tcl
      GROUP BY tcl.owner_email
    ) reached_stats ON dialed_stats.agent_email = reached_stats.agent_email
    FULL OUTER JOIN (
    -- INSTANT_PRESENTATION: From agent_dial_metrics (event_type = 'instant_presentation')
      -- CRITICAL: Only count if call duration is over 15 minutes (900 seconds)
      SELECT
        adm.agent_email,
        COUNT(DISTINCT adm.lead_phone) as new_instant_presentation
      FROM agent_dial_metrics adm
      LEFT JOIN twilio_call_logs tcl ON adm.call_sid = tcl.twilio_call_sid
      WHERE adm.event_timestamp >= today_start
        AND adm.event_timestamp < today_end
        AND adm.agent_email IS NOT NULL
        AND adm.agent_email != ''
        AND adm.lead_phone IS NOT NULL
        AND (
          LOWER(adm.event_type) = 'instant_presentation'
          OR LOWER(COALESCE(adm.disposition, '')) = 'instant_presentation'
        )
        AND COALESCE(tcl.call_duration, adm.call_duration, 0) > 900  -- Only count if duration is over 15 minutes
      GROUP BY adm.agent_email
    ) instant_presentation_stats ON dialed_stats.agent_email = instant_presentation_stats.agent_email
    FULL OUTER JOIN (
      -- BOOKED: ONLY from agent_dial_metrics
      SELECT 
        adm.agent_email,
        COUNT(DISTINCT adm.lead_phone) as new_booked
      FROM agent_dial_metrics adm
      LEFT JOIN twilio_call_logs tcl ON adm.call_sid = tcl.twilio_call_sid
      WHERE adm.event_timestamp >= today_start
        AND adm.event_timestamp < today_end
        AND adm.agent_email IS NOT NULL
        AND adm.agent_email != ''
        AND adm.lead_phone IS NOT NULL
        AND (LOWER(adm.event_type) = 'booked' OR LOWER(COALESCE(adm.disposition, '')) = 'booked')
        AND COALESCE(tcl.call_duration, adm.call_duration, 0) > 240
      GROUP BY adm.agent_email
    ) booked_stats ON dialed_stats.agent_email = booked_stats.agent_email
    WHERE COALESCE(dialed_stats.agent_email, reached_stats.agent_email, instant_presentation_stats.agent_email, booked_stats.agent_email) IS NOT NULL
  ) stats
  WHERE lcb.agent_email = stats.agent_email;
  
  -- Step 2: Insert new rows for agents who have metrics but aren't in live_call_boardt yet
  -- This ensures ALL agents with reach events (or any metrics) get counted
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
    COALESCE(dialed_stats.agent_email, reached_stats.agent_email, instant_presentation_stats.agent_email, booked_stats.agent_email) as agent_email,
    'offline' as status,
    COALESCE(dialed_stats.dialed, 0) as dialed,
    COALESCE(reached_stats.reached, 0) as reached,
    COALESCE(booked_stats.booked, 0) as booked,
    COALESCE(instant_presentation_stats.instant_presentation, 0) as instant_presentation,
    now() as updated_at
  FROM (
    -- DIALED: Count distinct phone numbers from twilio_call_logs (duration >= 1s OR answered)
    -- CRITICAL: Count DISTINCT to_number (unique phone numbers), not call_sids
    -- CRITICAL: Only count outbound calls with valid to_number (skip parent WebRTC calls)
    -- CRITICAL: Count as dial if: (duration >= 1) OR (status = 'answered' or 'completed')
    -- CRITICAL: Exclude failed/busy/no-answer/canceled (unless answered)
    SELECT 
      tcl.owner_email as agent_email,
      COUNT(DISTINCT tcl.to_number) as dialed
    FROM (
      -- First, get distinct phone numbers to prevent any duplicate counting
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
        AND call_direction = 'outbound'  -- ONLY count outbound calls
        AND to_number IS NOT NULL
        AND to_number != ''
        AND (
          (call_duration IS NOT NULL AND call_duration >= 1)
          OR LOWER(COALESCE(call_status, '')) IN ('answered', 'completed')
        )
        AND NOT (
          LOWER(COALESCE(call_status, '')) IN ('failed', 'busy', 'no-answer', 'canceled')
          AND LOWER(COALESCE(call_status, '')) NOT IN ('answered', 'completed')
        )
      ORDER BY owner_email, to_number, call_started_at DESC  -- Get most recent if duplicates exist
    ) tcl
    GROUP BY tcl.owner_email
  ) dialed_stats
  FULL OUTER JOIN (
    -- REACHED: From twilio_call_logs
    -- CRITICAL: Use DISTINCT on twilio_call_sid to prevent duplicates
    -- CRITICAL: Only count outbound calls that actually connected (duration >= 50s, status = answered/completed)
    SELECT 
      tcl.owner_email as agent_email,
      COUNT(DISTINCT tcl.twilio_call_sid) as reached
    FROM (
      -- First, get distinct call_sids to prevent any duplicate counting
      SELECT DISTINCT ON (twilio_call_sid)
        twilio_call_sid,
        owner_email,
        call_direction,
        to_number,
        call_duration,
        call_status
      FROM twilio_call_logs
      WHERE call_started_at >= today_start
        AND call_started_at < today_end
        AND owner_email IS NOT NULL
        AND owner_email != ''
        AND call_direction = 'outbound'  -- ONLY count outbound calls
        AND call_duration IS NOT NULL
        AND call_duration >= 50
        AND LOWER(COALESCE(call_status, '')) IN ('answered', 'completed')
        AND to_number IS NOT NULL
        AND to_number != ''
      ORDER BY twilio_call_sid, call_started_at DESC  -- Get most recent if duplicates exist
    ) tcl
    GROUP BY tcl.owner_email
    ) reached_stats ON dialed_stats.agent_email = reached_stats.agent_email
    FULL OUTER JOIN (
    -- INSTANT_PRESENTATION: From agent_dial_metrics (event_type = 'instant_presentation')
      -- CRITICAL: Only count if call duration is over 15 minutes (900 seconds)
      SELECT
        adm.agent_email,
        COUNT(DISTINCT adm.lead_phone) as instant_presentation
      FROM agent_dial_metrics adm
      LEFT JOIN twilio_call_logs tcl ON adm.call_sid = tcl.twilio_call_sid
      WHERE adm.event_timestamp >= today_start
        AND adm.event_timestamp < today_end
        AND adm.agent_email IS NOT NULL
        AND adm.agent_email != ''
        AND adm.lead_phone IS NOT NULL
        AND (
          LOWER(adm.event_type) = 'instant_presentation'
          OR LOWER(COALESCE(adm.disposition, '')) = 'instant_presentation'
        )
        AND COALESCE(tcl.call_duration, adm.call_duration, 0) > 900  -- Only count if duration is over 15 minutes
      GROUP BY adm.agent_email
    ) instant_presentation_stats ON dialed_stats.agent_email = instant_presentation_stats.agent_email
  FULL OUTER JOIN (
    -- BOOKED: ONLY from agent_dial_metrics (includes 'booked' and 'instant_presentation')
    SELECT
      adm.agent_email,
      COUNT(DISTINCT adm.lead_phone) as booked
    FROM agent_dial_metrics adm
    LEFT JOIN twilio_call_logs tcl ON adm.call_sid = tcl.twilio_call_sid
    WHERE adm.event_timestamp >= today_start
      AND adm.event_timestamp < today_end
      AND adm.agent_email IS NOT NULL
      AND adm.agent_email != ''
      AND adm.lead_phone IS NOT NULL
      AND (
        LOWER(adm.event_type) = 'booked' 
        OR LOWER(COALESCE(adm.disposition, '')) = 'booked'
        OR LOWER(adm.event_type) = 'instant_presentation'
        OR LOWER(COALESCE(adm.disposition, '')) = 'instant_presentation'
      )
      AND COALESCE(tcl.call_duration, adm.call_duration, 0) > 240
    GROUP BY adm.agent_email
  ) booked_stats ON dialed_stats.agent_email = booked_stats.agent_email
  FULL OUTER JOIN (
    -- REACHED: From twilio_call_logs
    SELECT 
      tcl.owner_email as agent_email,
      COUNT(DISTINCT tcl.twilio_call_sid) as reached
    FROM twilio_call_logs tcl
    WHERE tcl.call_started_at >= today_start
      AND tcl.call_started_at < today_end
      AND tcl.owner_email IS NOT NULL
      AND tcl.owner_email != ''
      AND tcl.call_duration IS NOT NULL
      AND tcl.call_duration >= 50
      AND LOWER(COALESCE(tcl.call_status, '')) IN ('answered', 'completed')
      AND tcl.to_number IS NOT NULL
      AND tcl.to_number != ''
    GROUP BY tcl.owner_email
  ) reached_stats ON dialed_stats.agent_email = reached_stats.agent_email
  FULL OUTER JOIN (
    -- INSTANT_PRESENTATION: From agent_dial_metrics (event_type = 'instant_presentation')
    -- CRITICAL: Only count if call duration is over 15 minutes (900 seconds)
    SELECT
      adm.agent_email,
      COUNT(DISTINCT adm.lead_phone) as instant_presentation
    FROM agent_dial_metrics adm
    LEFT JOIN twilio_call_logs tcl ON adm.call_sid = tcl.twilio_call_sid
    WHERE adm.event_timestamp >= today_start
      AND adm.event_timestamp < today_end
      AND adm.agent_email IS NOT NULL
      AND adm.agent_email != ''
      AND adm.lead_phone IS NOT NULL
      AND (
        LOWER(adm.event_type) = 'instant_presentation'
        OR LOWER(COALESCE(adm.disposition, '')) = 'instant_presentation'
      )
      AND COALESCE(tcl.call_duration, adm.call_duration, 0) > 900  -- Only count if duration is over 15 minutes
    GROUP BY adm.agent_email
  ) instant_presentation_stats ON dialed_stats.agent_email = instant_presentation_stats.agent_email
  FULL OUTER JOIN (
    -- BOOKED: ONLY from agent_dial_metrics (includes 'booked' and 'instant_presentation')
    SELECT
      adm.agent_email,
      COUNT(DISTINCT adm.lead_phone) as booked
    FROM agent_dial_metrics adm
    LEFT JOIN twilio_call_logs tcl ON adm.call_sid = tcl.twilio_call_sid
    WHERE adm.event_timestamp >= today_start
      AND adm.event_timestamp < today_end
      AND adm.agent_email IS NOT NULL
      AND adm.agent_email != ''
      AND adm.lead_phone IS NOT NULL
      AND (
        LOWER(adm.event_type) = 'booked' 
        OR LOWER(COALESCE(adm.disposition, '')) = 'booked'
        OR LOWER(adm.event_type) = 'instant_presentation'
        OR LOWER(COALESCE(adm.disposition, '')) = 'instant_presentation'
      )
      AND COALESCE(tcl.call_duration, adm.call_duration, 0) > 240
    GROUP BY adm.agent_email
  ) booked_stats ON dialed_stats.agent_email = booked_stats.agent_email
  WHERE COALESCE(dialed_stats.agent_email, reached_stats.agent_email, instant_presentation_stats.agent_email, booked_stats.agent_email) IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM live_call_boardt lcb2 
      WHERE lcb2.agent_email = COALESCE(dialed_stats.agent_email, reached_stats.agent_email, instant_presentation_stats.agent_email, booked_stats.agent_email)
    )
  ON CONFLICT (agent_email) 
  DO UPDATE SET
    today_dialed = EXCLUDED.today_dialed,
    today_reached = EXCLUDED.today_reached,
    today_booked = EXCLUDED.today_booked,
    today_instant_presentation = EXCLUDED.today_instant_presentation,
    updated_at = EXCLUDED.updated_at;
  
  RAISE NOTICE 'Backfill complete: All live_call_boardt stats recalculated with corrected logic (DISTINCT phone numbers, includes all agents with metrics)';
END;
$$;

-- ============================================================================
-- NOTE: DO NOT RUN backfill_live_call_boardt_stats_corrected() OR 
-- update_live_call_boardt_stats_from_metrics() AUTOMATICALLY
-- These functions contain reset logic that will clear your stats!
-- Only run them manually when needed.
-- ============================================================================

-- REMOVED: All automatic execution of backfill/reset functions
-- These were resetting stats to 0 incorrectly
-- If you need to recalculate stats, run fix-booked-stats-in-live-call-board.sql instead

-- ============================================================================
-- DIAGNOSTIC QUERY: Check raw data for a specific agent
-- Replace 'sethbogen@aoglobelife.com' with the agent email you want to check
-- ============================================================================
/*
SELECT 
  'DIALED' as metric_type,
  COUNT(*) as total_events,
  COUNT(DISTINCT lead_phone) as unique_phones,
  array_agg(DISTINCT lead_phone ORDER BY lead_phone) as phone_numbers
FROM agent_dial_metrics
WHERE agent_email = 'sethbogen@aoglobelife.com'
  AND event_type = 'dial'
  AND event_timestamp >= date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York'
  AND event_timestamp < date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York' + interval '1 day'
  AND lead_phone IS NOT NULL

UNION ALL

SELECT 
  'REACHED' as metric_type,
  COUNT(*) as total_events,
  COUNT(DISTINCT lead_phone) as unique_phones,
  array_agg(DISTINCT lead_phone ORDER BY lead_phone) as phone_numbers
FROM agent_dial_metrics
WHERE agent_email = 'sethbogen@aoglobelife.com'
  AND LOWER(event_type) = 'reach'
  AND event_timestamp >= date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York'
  AND event_timestamp < date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York' + interval '1 day'
  AND lead_phone IS NOT NULL

UNION ALL

SELECT 
  'BOOKED' as metric_type,
  COUNT(*) as total_events,
  COUNT(DISTINCT lead_phone) as unique_phones,
  array_agg(DISTINCT lead_phone ORDER BY lead_phone) as phone_numbers
FROM agent_dial_metrics
WHERE agent_email = 'sethbogen@aoglobelife.com'
  AND event_type = 'booked'
  AND LOWER(COALESCE(disposition, '')) = 'booked'
  AND event_timestamp >= date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York'
  AND event_timestamp < date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York' + interval '1 day'
  AND lead_phone IS NOT NULL;
*/

