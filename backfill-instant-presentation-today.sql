-- Backfill instant_presentation data for today in live_call_boardt
-- This counts instant_presentation events from agent_dial_metrics for today and updates live_call_boardt

-- Step 1: Get today's date range in EST timezone
DO $$
DECLARE
  today_start timestamptz;
  today_end timestamptz;
  agent_email_var text;
  instant_presentation_count integer;
  updated_count integer := 0;
BEGIN
  -- Get today's date range in EST timezone, then convert to UTC for querying
  today_start := date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York';
  today_end := today_start + interval '1 day';
  
  RAISE NOTICE '📅 Backfilling instant_presentation for today (EST): % to %', today_start, today_end;
  
  -- Loop through all agents in live_call_boardt and update their instant_presentation count
  FOR agent_email_var IN 
    SELECT DISTINCT agent_email 
    FROM live_call_boardt 
    WHERE agent_email IS NOT NULL
  LOOP
    -- Count instant_presentation events for this agent today
    SELECT 
      COUNT(DISTINCT CASE 
        WHEN (LOWER(event_type) = 'instant_presentation' OR LOWER(COALESCE(disposition, '')) = 'instant_presentation') 
        THEN lead_phone 
      END) as instant_presentation
    INTO instant_presentation_count
    FROM agent_dial_metrics
    WHERE agent_email = agent_email_var
      AND event_timestamp >= today_start
      AND event_timestamp < today_end
      AND lead_phone IS NOT NULL;
    
    -- Update live_call_boardt with the count
    UPDATE live_call_boardt
    SET 
      today_instant_presentation = COALESCE(instant_presentation_count, 0),
      updated_at = now()
    WHERE agent_email = agent_email_var;
    
    IF instant_presentation_count > 0 THEN
      updated_count := updated_count + 1;
      RAISE NOTICE '✅ Updated %: % instant presentations', agent_email_var, instant_presentation_count;
    END IF;
  END LOOP;
  
  RAISE NOTICE '✅ Backfill complete: Updated % agents with instant_presentation data', updated_count;
END $$;

-- Step 2: Also update agents that might not be in live_call_boardt yet but have instant_presentation events today
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
  0 as today_dialed,
  0 as today_reached,
  0 as today_booked,
  COUNT(DISTINCT CASE 
    WHEN (LOWER(event_type) = 'instant_presentation' OR LOWER(COALESCE(disposition, '')) = 'instant_presentation') 
    THEN lead_phone 
  END) as today_instant_presentation,
  now() as updated_at
FROM agent_dial_metrics
WHERE event_timestamp >= date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York'
  AND event_timestamp < date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York' + interval '1 day'
  AND agent_email IS NOT NULL
  AND agent_email != ''
  AND lead_phone IS NOT NULL
  AND (LOWER(event_type) = 'instant_presentation' OR LOWER(COALESCE(disposition, '')) = 'instant_presentation')
  AND agent_email NOT IN (SELECT agent_email FROM live_call_boardt WHERE agent_email IS NOT NULL)
GROUP BY agent_email
ON CONFLICT (agent_email) DO NOTHING;

-- Step 3: Show summary of results
SELECT 
  agent_email,
  today_instant_presentation,
  today_booked,
  today_dialed,
  today_reached
FROM live_call_boardt
WHERE today_instant_presentation > 0
ORDER BY today_instant_presentation DESC, agent_email;

SELECT '✅ Backfill complete! Check results above.' AS status;




