-- DEBUG: Test the SQL function to see what's happening
-- Run this to diagnose why the function isn't updating properly

-- Step 1: Check what the function calculates for a specific agent
DO $$
DECLARE
  test_email text := 'wilmerfernandez@aoglobelife.com'; -- Change this to test a specific agent
  today_start timestamptz;
  today_end timestamptz;
  dialed_count integer;
  reached_count integer;
  booked_count integer;
  existing_dialed integer;
  existing_reached integer;
  existing_booked integer;
BEGIN
  -- Get today's EST date range
  today_start := date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York';
  today_end := today_start + interval '1 day';
  
  RAISE NOTICE '📅 EST Date Range: % to %', today_start, today_end;
  
  -- Get existing values
  SELECT today_dialed, today_reached, today_booked
  INTO existing_dialed, existing_reached, existing_booked
  FROM live_call_boardt
  WHERE agent_email = test_email;
  
  RAISE NOTICE '📊 Existing values: dialed=%, reached=%, booked=%', 
    COALESCE(existing_dialed, 0), 
    COALESCE(existing_reached, 0), 
    COALESCE(existing_booked, 0);
  
  -- Calculate what the function would set
  SELECT 
    COUNT(DISTINCT CASE WHEN LOWER(event_type) = 'dial' THEN lead_phone END),
    COUNT(DISTINCT CASE WHEN LOWER(COALESCE(call_status, '')) = 'completed' AND LOWER(event_type) = 'dial' THEN lead_phone END),
    COUNT(DISTINCT CASE WHEN (LOWER(event_type) = 'booked' OR LOWER(COALESCE(disposition, '')) = 'booked') THEN lead_phone END)
  INTO dialed_count, reached_count, booked_count
  FROM agent_dial_metrics
  WHERE agent_email = test_email
    AND event_timestamp >= today_start
    AND event_timestamp < today_end
    AND agent_email IS NOT NULL
    AND agent_email != ''
    AND lead_phone IS NOT NULL;
  
  RAISE NOTICE '🔢 Calculated values: dialed=%, reached=%, booked=%', 
    COALESCE(dialed_count, 0), 
    COALESCE(reached_count, 0), 
    COALESCE(booked_count, 0);
  
  -- Show what would be updated
  RAISE NOTICE '✅ Would update dialed: % (new > existing: %)', 
    CASE WHEN COALESCE(dialed_count, 0) > COALESCE(existing_dialed, 0) THEN dialed_count ELSE existing_dialed END,
    COALESCE(dialed_count, 0) > COALESCE(existing_dialed, 0);
  
  RAISE NOTICE '✅ Would update reached: % (new > existing: %)', 
    CASE WHEN COALESCE(reached_count, 0) > COALESCE(existing_reached, 0) THEN reached_count ELSE existing_reached END,
    COALESCE(reached_count, 0) > COALESCE(existing_reached, 0);
  
  RAISE NOTICE '✅ Would update booked: % (new > existing: %)', 
    CASE WHEN COALESCE(booked_count, 0) > COALESCE(existing_booked, 0) THEN booked_count ELSE existing_booked END,
    COALESCE(booked_count, 0) > COALESCE(existing_booked, 0);
  
  -- Show sample metrics
  RAISE NOTICE '📋 Sample metrics for this agent today:';
  FOR rec IN 
    SELECT event_type, call_status, disposition, lead_phone, event_timestamp
    FROM agent_dial_metrics
    WHERE agent_email = test_email
      AND event_timestamp >= today_start
      AND event_timestamp < today_end
    ORDER BY event_timestamp DESC
    LIMIT 10
  LOOP
    RAISE NOTICE '  - event_type=%, call_status=%, disposition=%, phone=%, time=%', 
      rec.event_type, rec.call_status, rec.disposition, rec.lead_phone, rec.event_timestamp;
  END LOOP;
  
END $$;

-- Step 2: Check all agents and see what the function would do
SELECT 
  lcb.agent_email,
  lcb.today_dialed as existing_dialed,
  lcb.today_reached as existing_reached,
  lcb.today_booked as existing_booked,
  COALESCE(stats.calc_dialed, 0) as calc_dialed,
  COALESCE(stats.calc_reached, 0) as calc_reached,
  COALESCE(stats.calc_booked, 0) as calc_booked,
  CASE WHEN COALESCE(stats.calc_dialed, 0) > COALESCE(lcb.today_dialed, 0) THEN 'YES' ELSE 'NO' END as would_update_dialed,
  CASE WHEN COALESCE(stats.calc_reached, 0) > COALESCE(lcb.today_reached, 0) THEN 'YES' ELSE 'NO' END as would_update_reached,
  CASE WHEN COALESCE(stats.calc_booked, 0) > COALESCE(lcb.today_booked, 0) THEN 'YES' ELSE 'NO' END as would_update_booked
FROM live_call_boardt lcb
LEFT JOIN (
  SELECT 
    agent_email,
    COUNT(DISTINCT CASE WHEN LOWER(event_type) = 'dial' THEN lead_phone END) as calc_dialed,
    COUNT(DISTINCT CASE WHEN LOWER(COALESCE(call_status, '')) = 'completed' AND LOWER(event_type) = 'dial' THEN lead_phone END) as calc_reached,
    COUNT(DISTINCT CASE WHEN (LOWER(event_type) = 'booked' OR LOWER(COALESCE(disposition, '')) = 'booked') THEN lead_phone END) as calc_booked
  FROM agent_dial_metrics
  WHERE event_timestamp >= (SELECT today_start FROM get_today_est_range())
    AND event_timestamp < (SELECT today_end FROM get_today_est_range())
    AND agent_email IS NOT NULL
    AND agent_email != ''
    AND lead_phone IS NOT NULL
  GROUP BY agent_email
) stats ON lcb.agent_email = stats.agent_email
WHERE (stats.calc_dialed > lcb.today_dialed 
    OR stats.calc_reached > lcb.today_reached 
    OR stats.calc_booked > lcb.today_booked
    OR stats.calc_dialed IS NULL)
ORDER BY lcb.agent_email
LIMIT 20;

