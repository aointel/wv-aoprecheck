-- FIND ALL FUNCTIONS AND TRIGGERS THAT UPDATE live_call_boardt
-- Run this to see what's actually in the database

-- Step 1: Find ALL functions that reference live_call_boardt
SELECT 
  routine_name,
  routine_type,
  routine_definition
FROM information_schema.routines
WHERE routine_definition LIKE '%live_call_boardt%'
  AND routine_schema = 'public'
ORDER BY routine_name;

-- Step 2: Find ALL triggers on agent_dial_metrics
SELECT 
  tgname as trigger_name,
  tgenabled as enabled,
  CASE tgenabled
    WHEN 'O' THEN 'ENABLED'
    WHEN 'D' THEN 'DISABLED'
    WHEN 'R' THEN 'REPLICA'
    WHEN 'A' THEN 'ALWAYS'
    ELSE 'UNKNOWN'
  END as status,
  pg_get_triggerdef(oid) as definition
FROM pg_trigger
WHERE tgrelid = 'agent_dial_metrics'::regclass
ORDER BY tgname;

-- Step 3: Find ALL cron jobs that might be running
SELECT 
  jobid,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active,
  jobname
FROM cron.job
WHERE command LIKE '%live_call_boardt%'
   OR command LIKE '%update_live_call_boardt%'
   OR command LIKE '%update_live_call_board%'
ORDER BY jobid;

-- Step 4: Check what the CURRENT function calculates vs what's in the table
-- Replace 'wilmerfernandez@aoglobelife.com' with an agent that's having issues
DO $$
DECLARE
  test_email text := 'wilmerfernandez@aoglobelife.com';
  today_start timestamptz;
  today_end timestamptz;
  calc_dialed integer;
  calc_reached integer;
  calc_booked integer;
  existing_dialed integer;
  existing_reached integer;
  existing_booked integer;
BEGIN
  today_start := date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York';
  today_end := today_start + interval '1 day';
  
  -- Get existing
  SELECT today_dialed, today_reached, today_booked
  INTO existing_dialed, existing_reached, existing_booked
  FROM live_call_boardt
  WHERE agent_email = test_email;
  
  -- Calculate what function would set
  SELECT 
    COUNT(DISTINCT CASE WHEN LOWER(event_type) = 'dial' THEN lead_phone END),
    COUNT(DISTINCT CASE WHEN LOWER(COALESCE(call_status, '')) = 'completed' AND LOWER(event_type) = 'dial' THEN lead_phone END),
    COUNT(DISTINCT CASE WHEN (LOWER(event_type) = 'booked' OR LOWER(COALESCE(disposition, '')) = 'booked') THEN lead_phone END)
  INTO calc_dialed, calc_reached, calc_booked
  FROM agent_dial_metrics
  WHERE agent_email = test_email
    AND event_timestamp >= today_start
    AND event_timestamp < today_end
    AND agent_email IS NOT NULL
    AND agent_email != ''
    AND lead_phone IS NOT NULL;
  
  RAISE NOTICE '📊 Agent: %', test_email;
  RAISE NOTICE '   Existing: dialed=%, reached=%, booked=%', 
    COALESCE(existing_dialed, 0), COALESCE(existing_reached, 0), COALESCE(existing_booked, 0);
  RAISE NOTICE '   Calculated: dialed=%, reached=%, booked=%', 
    COALESCE(calc_dialed, 0), COALESCE(calc_reached, 0), COALESCE(calc_booked, 0);
  RAISE NOTICE '   Difference: dialed=%, reached=%, booked=%', 
    COALESCE(calc_dialed, 0) - COALESCE(existing_dialed, 0),
    COALESCE(calc_reached, 0) - COALESCE(existing_reached, 0),
    COALESCE(calc_booked, 0) - COALESCE(existing_booked, 0);
END $$;

