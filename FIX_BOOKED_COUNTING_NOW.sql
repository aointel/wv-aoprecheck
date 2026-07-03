-- ============================================================================
-- FIX: Booked counting is wrong - it's counting disposition='booked' on dial/reach events
-- CORRECT: Only count event_type='booked' (separate row that should be logged)
-- ============================================================================

-- Fix the main function
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
    -- DIALED: Count distinct phone numbers from twilio_call_logs
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
    -- REACHED/BOOKED/INSTANT_PRESENTATION: From agent_dial_metrics
    SELECT
      adm.agent_email,
      -- REACHED: Count distinct phones where event_type = 'reach'
      COUNT(DISTINCT CASE 
        WHEN LOWER(adm.event_type) = 'reach'
        THEN adm.lead_phone 
      END) as reached,
      -- BOOKED: ONLY count event_type='booked' (NOT disposition='booked' on dial/reach events!)
      COUNT(DISTINCT CASE 
        WHEN LOWER(adm.event_type) = 'booked' 
        THEN adm.lead_phone 
      END) as booked,
      -- INSTANT_PRESENTATION: Count distinct phones where event_type = 'instant_presentation'
      COUNT(DISTINCT CASE 
        WHEN LOWER(adm.event_type) = 'instant_presentation'
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

-- Fix the single-agent function
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
  -- Count as dial if: (duration >= 1) OR (status = 'answered' or 'completed')
  -- Exclude: failed, busy, no-answer, canceled (unless answered)
  SELECT COUNT(DISTINCT tcl.to_number)
  INTO dialed_count
  FROM twilio_call_logs tcl
  WHERE tcl.owner_email = p_agent_email
    AND tcl.call_started_at >= today_start
    AND tcl.call_started_at < today_end
    AND tcl.call_direction = 'outbound'
    AND tcl.to_number IS NOT NULL
    AND tcl.to_number != ''
    AND (
      (tcl.call_duration IS NOT NULL AND tcl.call_duration >= 1)
      OR LOWER(COALESCE(tcl.call_status, '')) IN ('answered', 'completed')
    )
    AND NOT (
      LOWER(COALESCE(tcl.call_status, '')) IN ('failed', 'busy', 'no-answer', 'canceled')
      AND LOWER(COALESCE(tcl.call_status, '')) NOT IN ('answered', 'completed')
    );
  
  -- REACHED/BOOKED/INSTANT_PRESENTATION: From agent_dial_metrics
  -- CRITICAL: Only count event_type, NOT disposition
  SELECT
    COUNT(DISTINCT CASE WHEN LOWER(adm.event_type) = 'reach' THEN adm.lead_phone END) as reached,
    COUNT(DISTINCT CASE 
      WHEN LOWER(adm.event_type) = 'booked'
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

-- Run it immediately to fix current stats
SELECT update_live_call_boardt_stats_from_metrics();

-- Verify the fix
DO $$
BEGIN
  RAISE NOTICE '✅ FIXED: Booked now only counts event_type=''booked'', not disposition=''booked'' on dial/reach events';
  RAISE NOTICE '✅ Run the function to update all stats with correct counting';
END $$;
