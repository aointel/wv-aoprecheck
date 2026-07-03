-- VERIFY AND FIX: Check if triggers are working and fix if needed
-- Run this to diagnose and fix the trigger issue

-- Step 1: Check if functions exist
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_name IN (
  'update_live_call_boardt_stats_for_agent',
  'update_live_call_boardt_stats_from_metrics',
  'trigger_update_live_call_boardt_on_metric',
  'get_today_est_range'
)
ORDER BY routine_name;

-- Step 2: Check if triggers exist and are enabled
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
  AND tgname LIKE '%live_call_boardt%';

-- Step 3: Test the trigger function manually with a real agent
DO $$
DECLARE
  test_email text;
  test_result text;
BEGIN
  -- Get a test email from recent metrics
  SELECT agent_email INTO test_email
  FROM agent_dial_metrics
  WHERE agent_email IS NOT NULL
    AND agent_email != ''
    AND event_timestamp >= (SELECT today_start FROM get_today_est_range())
    AND event_timestamp < (SELECT today_end FROM get_today_est_range())
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF test_email IS NULL THEN
    RAISE NOTICE '❌ No agent emails found in today''s metrics';
    RETURN;
  END IF;
  
  RAISE NOTICE '🧪 Testing trigger function with agent: %', test_email;
  
  -- Call the function
  BEGIN
    PERFORM update_live_call_boardt_stats_for_agent(test_email);
    RAISE NOTICE '✅ Function executed successfully';
    
    -- Check result
    SELECT 
      today_dialed::text || ' dialed, ' || 
      today_reached::text || ' reached, ' || 
      today_booked::text || ' booked'
    INTO test_result
    FROM live_call_boardt
    WHERE agent_email = test_email;
    
    IF test_result IS NOT NULL THEN
      RAISE NOTICE '📊 Result: %', test_result;
    ELSE
      RAISE WARNING '⚠️ No row found in live_call_boardt for %', test_email;
    END IF;
    
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE '❌ ERROR executing function: %', SQLERRM;
      RAISE NOTICE '❌ Error details: %', SQLSTATE;
  END;
  
END $$;

-- Step 4: Check what the EST date range is
SELECT 
  today_start,
  today_end,
  now() as current_time,
  now() AT TIME ZONE 'America/New_York' as current_est_time
FROM get_today_est_range();

-- Step 5: Count metrics in EST date range
SELECT 
  COUNT(*) as total_metrics,
  COUNT(DISTINCT agent_email) as unique_agents,
  COUNT(DISTINCT CASE WHEN LOWER(event_type) = 'dial' THEN lead_phone END) as unique_dialed,
  COUNT(DISTINCT CASE WHEN LOWER(COALESCE(call_status, '')) = 'completed' AND LOWER(event_type) = 'dial' THEN lead_phone END) as unique_reached,
  COUNT(DISTINCT CASE WHEN (LOWER(event_type) = 'booked' OR LOWER(COALESCE(disposition, '')) = 'booked') THEN lead_phone END) as unique_booked
FROM agent_dial_metrics
WHERE event_timestamp >= (SELECT today_start FROM get_today_est_range())
  AND event_timestamp < (SELECT today_end FROM get_today_est_range())
  AND agent_email IS NOT NULL
  AND agent_email != ''
  AND lead_phone IS NOT NULL;

-- Step 6: Force update all agents
SELECT update_live_call_boardt_stats_from_metrics();

-- Step 7: Check updated_at timestamps
SELECT 
  agent_email,
  today_dialed,
  today_reached,
  today_booked,
  updated_at,
  EXTRACT(EPOCH FROM (now() - updated_at)) as seconds_since_update
FROM live_call_boardt
WHERE updated_at >= now() - interval '5 minutes'
ORDER BY updated_at DESC
LIMIT 10;


