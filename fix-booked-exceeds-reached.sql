-- FIX: Booked should never exceed Reached
-- This ensures booked only counts when there's a corresponding reach event

-- Drop and recreate all functions with corrected booked logic
DROP FUNCTION IF EXISTS update_live_call_boardt_stats_from_metrics() CASCADE;
DROP FUNCTION IF EXISTS update_live_call_boardt_stats_for_agent(text) CASCADE;
DROP FUNCTION IF EXISTS backfill_live_call_boardt_stats_corrected() CASCADE;

-- Main function: Update all agents
CREATE OR REPLACE FUNCTION update_live_call_boardt_stats_from_metrics()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  today_start timestamptz;
  today_end timestamptz;
BEGIN
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
    adm.agent_email,
    'offline' as status,
    COUNT(DISTINCT CASE WHEN LOWER(adm.event_type) = 'dial' THEN adm.lead_phone END) as dialed,
    -- REACHED: Count event_type = 'reach' records
    COUNT(DISTINCT CASE 
      WHEN LOWER(adm.event_type) = 'reach' 
        AND LOWER(COALESCE(adm.disposition, '')) NOT IN ('wrong_number', 'wrong number', 'bad_number')
      THEN adm.lead_phone 
    END) as reached,
    -- BOOKED: Only count if there's also a reach event (can't book without reaching)
    COUNT(DISTINCT CASE 
      WHEN (LOWER(adm.event_type) = 'booked' OR LOWER(COALESCE(adm.disposition, '')) = 'booked')
        AND EXISTS (
          SELECT 1 
          FROM agent_dial_metrics reach_check
          WHERE reach_check.agent_email = adm.agent_email
            AND reach_check.lead_phone = adm.lead_phone
            AND LOWER(reach_check.event_type) = 'reach'
            AND LOWER(COALESCE(reach_check.disposition, '')) NOT IN ('wrong_number', 'wrong number', 'bad_number')
            AND reach_check.event_timestamp >= today_start
            AND reach_check.event_timestamp < today_end
        )
      THEN adm.lead_phone 
    END) as booked,
    COUNT(DISTINCT CASE WHEN (LOWER(adm.event_type) = 'instant_presentation' OR LOWER(COALESCE(adm.disposition, '')) = 'instant_presentation') THEN adm.lead_phone END) as instant_presentation,
    now() as updated_at
  FROM agent_dial_metrics adm
  WHERE adm.event_timestamp >= today_start
    AND adm.event_timestamp < today_end
    AND adm.agent_email IS NOT NULL
    AND adm.agent_email != ''
    AND adm.lead_phone IS NOT NULL
  GROUP BY adm.agent_email
  ON CONFLICT (agent_email) 
  DO UPDATE SET
    today_dialed = EXCLUDED.today_dialed,
    today_reached = EXCLUDED.today_reached,
    today_booked = EXCLUDED.today_booked,
    today_instant_presentation = EXCLUDED.today_instant_presentation,
    updated_at = EXCLUDED.updated_at;
END;
$$;

-- Single agent function
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
  
  SELECT 
    COUNT(DISTINCT CASE WHEN LOWER(adm.event_type) = 'dial' THEN adm.lead_phone END) as dialed,
    COUNT(DISTINCT CASE 
      WHEN LOWER(adm.event_type) = 'reach' 
        AND LOWER(COALESCE(adm.disposition, '')) NOT IN ('wrong_number', 'wrong number', 'bad_number')
      THEN adm.lead_phone 
    END) as reached,
    COUNT(DISTINCT CASE 
      WHEN (LOWER(adm.event_type) = 'booked' OR LOWER(COALESCE(adm.disposition, '')) = 'booked')
        AND EXISTS (
          SELECT 1 
          FROM agent_dial_metrics reach_check
          WHERE reach_check.agent_email = adm.agent_email
            AND reach_check.lead_phone = adm.lead_phone
            AND LOWER(reach_check.event_type) = 'reach'
            AND LOWER(COALESCE(reach_check.disposition, '')) NOT IN ('wrong_number', 'wrong number', 'bad_number')
            AND reach_check.event_timestamp >= today_start
            AND reach_check.event_timestamp < today_end
        )
      THEN adm.lead_phone 
    END) as booked,
    COUNT(DISTINCT CASE WHEN (LOWER(adm.event_type) = 'instant_presentation' OR LOWER(COALESCE(adm.disposition, '')) = 'instant_presentation') THEN adm.lead_phone END) as instant_presentation
  INTO dialed_count, reached_count, booked_count, instant_presentation_count
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

-- Backfill function
CREATE OR REPLACE FUNCTION backfill_live_call_boardt_stats_corrected()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  today_start timestamptz;
  today_end timestamptz;
BEGIN
  today_start := date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York';
  today_end := today_start + interval '1 day';
  
  UPDATE live_call_boardt lcb
  SET 
    today_dialed = COALESCE(stats.new_dialed, 0),
    today_reached = COALESCE(stats.new_reached, 0),
    today_booked = COALESCE(stats.new_booked, 0),
    today_instant_presentation = COALESCE(stats.new_instant_presentation, 0),
    updated_at = now()
  FROM (
    SELECT 
      adm.agent_email,
      COUNT(DISTINCT CASE WHEN LOWER(adm.event_type) = 'dial' THEN adm.lead_phone END) as new_dialed,
      COUNT(DISTINCT CASE 
        WHEN LOWER(adm.event_type) = 'reach' 
          AND LOWER(COALESCE(adm.disposition, '')) NOT IN ('wrong_number', 'wrong number', 'bad_number')
        THEN adm.lead_phone 
      END) as new_reached,
      COUNT(DISTINCT CASE 
        WHEN (LOWER(adm.event_type) = 'booked' OR LOWER(COALESCE(adm.disposition, '')) = 'booked')
          AND EXISTS (
            SELECT 1 
            FROM agent_dial_metrics reach_check
            WHERE reach_check.agent_email = adm.agent_email
              AND reach_check.lead_phone = adm.lead_phone
              AND LOWER(reach_check.event_type) = 'reach'
              AND LOWER(COALESCE(reach_check.disposition, '')) NOT IN ('wrong_number', 'wrong number', 'bad_number')
              AND reach_check.event_timestamp >= today_start
              AND reach_check.event_timestamp < today_end
          )
        THEN adm.lead_phone 
      END) as new_booked,
      COUNT(DISTINCT CASE WHEN (LOWER(adm.event_type) = 'instant_presentation' OR LOWER(COALESCE(adm.disposition, '')) = 'instant_presentation') THEN adm.lead_phone END) as new_instant_presentation
    FROM agent_dial_metrics adm
    WHERE adm.event_timestamp >= today_start
      AND adm.event_timestamp < today_end
      AND adm.agent_email IS NOT NULL
      AND adm.agent_email != ''
      AND adm.lead_phone IS NOT NULL
    GROUP BY adm.agent_email
  ) stats
  WHERE lcb.agent_email = stats.agent_email;
  
  RAISE NOTICE 'Backfill complete: All live_call_boardt stats recalculated with corrected logic (booked <= reached)';
END;
$$;

-- Run it
SELECT update_live_call_boardt_stats_from_metrics();

-- Verify: Check for any agents where booked > reached (should be 0)
SELECT 
  agent_email,
  today_dialed,
  today_reached,
  today_booked,
  (today_booked - today_reached) as booked_minus_reached
FROM live_call_boardt
WHERE today_booked > today_reached
ORDER BY (today_booked - today_reached) DESC;
