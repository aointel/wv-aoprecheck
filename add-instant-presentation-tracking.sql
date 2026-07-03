-- Add instant_presentation tracking to live_call_boardt
-- This adds a new column to track instant presentations next to booked

-- Step 1: Add column for instant_presentation (if it doesn't exist)
ALTER TABLE live_call_boardt 
ADD COLUMN IF NOT EXISTS today_instant_presentation integer DEFAULT 0;

-- Step 2: Update the function to count instant_presentation events
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
  -- CRITICAL: Each phone number counts ONCE per event type per agent per day (DISTINCT ensures no duplicates)
  --   - DIALS: Count distinct phones where event_type = 'dial'
  --   - REACHES: Count distinct phones where call_status = 'completed' AND event_type = 'dial'
  --   - BOOKED: Count distinct phones where event_type = 'booked' OR disposition = 'booked'
  --   - INSTANT_PRESENTATION: Count distinct phones where event_type = 'instant_presentation' OR disposition = 'instant_presentation'
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

-- Step 3: Verify the column was added
SELECT 
  column_name, 
  data_type, 
  column_default
FROM information_schema.columns
WHERE table_name = 'live_call_boardt'
  AND column_name = 'today_instant_presentation';

-- Step 4: Test update function (optional - uncomment to test)
-- SELECT update_live_call_boardt_stats_for_agent('test@example.com');

SELECT '✅ instant_presentation tracking added successfully' AS status;

