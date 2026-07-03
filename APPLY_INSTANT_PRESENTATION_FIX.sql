-- ============================================================================
-- APPLY INSTANT PRESENTATION FIX
-- 
-- This recreates the function with the fix that trusts event_type='instant_presentation'
-- even if the duration check fails (for backfilled events)
-- ============================================================================

-- Recreate the function with the fix
CREATE OR REPLACE FUNCTION update_live_call_boardt_stats_from_metrics()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  today_start timestamptz;
  today_end timestamptz;
BEGIN
  -- Get today's date range in EST timezone, then convert to UTC for querying
  today_start := date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York';
  today_end := today_start + interval '1 day';
  
  -- DIALED: Count distinct phone numbers from twilio_call_logs (only calls with duration >= 15s)
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
    -- REACHED: From twilio_call_logs
    SELECT 
      tcl.owner_email as agent_email,
      COUNT(DISTINCT tcl.twilio_call_sid) as reached
    FROM (
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
        AND call_direction = 'outbound'
        AND call_duration IS NOT NULL
        AND call_duration >= 50
        AND LOWER(COALESCE(call_status, '')) IN ('answered', 'completed')
        AND to_number IS NOT NULL
        AND to_number != ''
      ORDER BY twilio_call_sid, call_started_at DESC
    ) tcl
    GROUP BY tcl.owner_email
  ) reached_stats ON dialed_stats.agent_email = reached_stats.agent_email
  FULL OUTER JOIN (
    -- INSTANT_PRESENTATION: From agent_dial_metrics (event_type = 'instant_presentation')
    -- FIX: Trust event_type='instant_presentation' even if duration check fails (for backfilled events)
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
      AND (
        -- If event_type is 'instant_presentation', trust it (was created from calls > 900s)
        LOWER(adm.event_type) = 'instant_presentation'
        -- OR verify duration is over 15 minutes
        OR COALESCE(tcl.call_duration, adm.call_duration, 0) > 900
      )
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
  
END;
$$;

-- Also fix the per-agent function
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
  today_start := date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York';
  today_end := today_start + interval '1 day';
  
  SELECT 
    -- DIALED: Count distinct phone numbers from twilio_call_logs that have duration >= 15s
    COALESCE((
      SELECT COUNT(DISTINCT tcl2.to_number)
      FROM twilio_call_logs tcl2
      WHERE tcl2.owner_email = p_agent_email
        AND tcl2.call_started_at >= today_start
        AND tcl2.call_started_at < today_end
        AND tcl2.call_direction = 'outbound'
        AND tcl2.call_duration IS NOT NULL
        AND tcl2.call_duration >= 15
        AND tcl2.to_number IS NOT NULL
        AND tcl2.to_number != ''
        AND LOWER(COALESCE(tcl2.call_status, '')) NOT IN ('failed', 'busy', 'no-answer', 'canceled')
    ), 0) as dialed,
    -- REACHED: From twilio_call_logs (calls with duration >= 50s, status = 'answered'/'completed')
    COALESCE((
      SELECT COUNT(DISTINCT tcl2.twilio_call_sid)
      FROM twilio_call_logs tcl2
      WHERE tcl2.owner_email = p_agent_email
        AND tcl2.call_started_at >= today_start
        AND tcl2.call_started_at < today_end
        AND tcl2.call_direction = 'outbound'
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
    -- FIX: Trust event_type='instant_presentation' even if duration check fails
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
    today_dialed = dialed_count,
    today_reached = reached_count,
    today_booked = booked_count,
    today_instant_presentation = instant_presentation_count,
    updated_at = now();
  
END;
$$;

-- Force update after applying fix
SELECT 
  'APPLYING FIX AND UPDATING' as action,
  update_live_call_boardt_stats_from_metrics() as result;
