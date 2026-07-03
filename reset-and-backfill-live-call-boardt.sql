-- Reset and Backfill live_call_boardt table
-- This script resets all today's stats to 0, then recalculates them from agent_dial_metrics

-- Step 1: Reset all today's stats columns to 0 for all agents
DO $$
DECLARE
  reset_count integer;
BEGIN
  UPDATE live_call_boardt
  SET 
    today_dialed = 0,
    today_reached = 0,
    today_booked = 0,
    today_instant_presentation = 0,
    today_presentations = 0,
    today_sales = 0,
    today_alp = 0,
    updated_at = now()
  WHERE agent_email IS NOT NULL;
  
  GET DIAGNOSTICS reset_count = ROW_COUNT;
  RAISE NOTICE '✅ Reset % agents: All today stats set to 0', reset_count;
END $$;

-- Step 2: Get today's date range in EST timezone
DO $$
DECLARE
  today_start timestamptz;
  today_end timestamptz;
  agent_email_var text;
  dialed_count integer;
  reached_count integer;
  booked_count integer;
  instant_presentation_count integer;
  updated_count integer := 0;
  processed_count integer := 0;
BEGIN
  -- Get today's date range in EST timezone, then convert to UTC for querying
  today_start := date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York';
  today_end := today_start + interval '1 day';
  
  RAISE NOTICE '📅 Backfilling stats for today (EST): % to %', today_start, today_end;
  
  -- Loop through all agents in live_call_boardt and recalculate their stats
  FOR agent_email_var IN 
    SELECT DISTINCT agent_email 
    FROM live_call_boardt 
    WHERE agent_email IS NOT NULL
  LOOP
    -- Count all metrics for this agent today from agent_dial_metrics
    SELECT 
      -- DIALED: Distinct phones only (filters duplicates)
      COUNT(DISTINCT CASE WHEN LOWER(event_type) = 'dial' THEN lead_phone END) as dialed,
      -- REACHED: Distinct phones only where call_status = 'completed' (filters duplicates)
      COUNT(DISTINCT CASE WHEN LOWER(COALESCE(call_status, '')) = 'completed' AND LOWER(event_type) = 'dial' THEN lead_phone END) as reached,
      -- BOOKED: Distinct phones only where booked (filters duplicates)
      COUNT(DISTINCT CASE WHEN (LOWER(event_type) = 'booked' OR LOWER(COALESCE(disposition, '')) = 'booked') THEN lead_phone END) as booked,
      -- INSTANT_PRESENTATION: Distinct phones only where instant_presentation (filters duplicates)
      COUNT(DISTINCT CASE WHEN (LOWER(event_type) = 'instant_presentation' OR LOWER(COALESCE(disposition, '')) = 'instant_presentation') THEN lead_phone END) as instant_presentation
    INTO dialed_count, reached_count, booked_count, instant_presentation_count
    FROM agent_dial_metrics
    WHERE agent_email = agent_email_var
      AND event_timestamp >= today_start
      AND event_timestamp < today_end
      AND lead_phone IS NOT NULL;
    
    -- Update live_call_boardt with the recalculated counts
    UPDATE live_call_boardt
    SET 
      today_dialed = COALESCE(dialed_count, 0),
      today_reached = COALESCE(reached_count, 0),
      today_booked = COALESCE(booked_count, 0),
      today_instant_presentation = COALESCE(instant_presentation_count, 0),
      updated_at = now()
    WHERE agent_email = agent_email_var;
    
    processed_count := processed_count + 1;
    
    -- Only log agents with activity to reduce noise
    IF COALESCE(dialed_count, 0) > 0 OR 
       COALESCE(reached_count, 0) > 0 OR 
       COALESCE(booked_count, 0) > 0 OR 
       COALESCE(instant_presentation_count, 0) > 0 THEN
      updated_count := updated_count + 1;
      RAISE NOTICE '✅ Updated %: D=% R=% B=% IP=%', 
        agent_email_var, 
        COALESCE(dialed_count, 0),
        COALESCE(reached_count, 0),
        COALESCE(booked_count, 0),
        COALESCE(instant_presentation_count, 0);
    END IF;
  END LOOP;
  
  RAISE NOTICE '✅ Backfill complete: Processed % agents, % with activity', processed_count, updated_count;
END $$;

-- Step 3: Also add agents that exist in agent_dial_metrics but not in live_call_boardt
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
  agent_email,
  'offline' as status,
  COUNT(DISTINCT CASE WHEN LOWER(event_type) = 'dial' THEN lead_phone END) as today_dialed,
  COUNT(DISTINCT CASE WHEN LOWER(COALESCE(call_status, '')) = 'completed' AND LOWER(event_type) = 'dial' THEN lead_phone END) as today_reached,
  COUNT(DISTINCT CASE WHEN (LOWER(event_type) = 'booked' OR LOWER(COALESCE(disposition, '')) = 'booked') THEN lead_phone END) as today_booked,
  COUNT(DISTINCT CASE WHEN (LOWER(event_type) = 'instant_presentation' OR LOWER(COALESCE(disposition, '')) = 'instant_presentation') THEN lead_phone END) as today_instant_presentation,
  now() as updated_at
FROM agent_dial_metrics
WHERE event_timestamp >= date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York'
  AND event_timestamp < date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York' + interval '1 day'
  AND agent_email IS NOT NULL
  AND agent_email != ''
  AND lead_phone IS NOT NULL
  AND agent_email NOT IN (SELECT agent_email FROM live_call_boardt WHERE agent_email IS NOT NULL)
GROUP BY agent_email
ON CONFLICT (agent_email) DO NOTHING;

-- Step 4: Show summary of results
SELECT 
  COUNT(*) as total_agents,
  SUM(CASE WHEN today_dialed > 0 THEN 1 ELSE 0 END) as agents_with_dials,
  SUM(CASE WHEN today_reached > 0 THEN 1 ELSE 0 END) as agents_with_reaches,
  SUM(CASE WHEN today_booked > 0 THEN 1 ELSE 0 END) as agents_with_bookings,
  SUM(CASE WHEN today_instant_presentation > 0 THEN 1 ELSE 0 END) as agents_with_instant_pres,
  SUM(today_dialed) as total_dials,
  SUM(today_reached) as total_reaches,
  SUM(today_booked) as total_bookings,
  SUM(today_instant_presentation) as total_instant_pres
FROM live_call_boardt
WHERE agent_email IS NOT NULL;

-- Step 5: Show top 10 agents by activity
SELECT 
  agent_email,
  today_dialed as D,
  today_reached as R,
  today_booked as B,
  today_instant_presentation as IP,
  (today_dialed * 1 + today_reached * 25 + today_booked * 50 + today_instant_presentation * 100) as points
FROM live_call_boardt
WHERE agent_email IS NOT NULL
  AND (today_dialed > 0 OR today_reached > 0 OR today_booked > 0 OR today_instant_presentation > 0)
ORDER BY points DESC, today_dialed DESC
LIMIT 10;

SELECT '✅ Reset and backfill complete! Check summary above.' AS status;



