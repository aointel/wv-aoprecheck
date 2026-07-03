-- TEST: Check if trigger function is working correctly
-- Run this to see if the function executes without errors

-- Step 1: Check if function exists and can be called
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_name = 'update_live_call_boardt_stats_for_agent';

-- Step 2: Get a real agent email from recent metrics
SELECT DISTINCT agent_email, MAX(created_at) as last_created
FROM agent_dial_metrics 
WHERE agent_email IS NOT NULL 
  AND agent_email != ''
GROUP BY agent_email
ORDER BY last_created DESC
LIMIT 5;

-- Step 3: Test the function manually with a real agent
-- Replace 'AGENT_EMAIL_HERE' with one of the emails from step 2
-- This will show any errors
DO $$
DECLARE
  test_email text;
BEGIN
  -- Get a test email
  SELECT agent_email INTO test_email
  FROM agent_dial_metrics
  WHERE agent_email IS NOT NULL
    AND agent_email != ''
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF test_email IS NULL THEN
    RAISE NOTICE '❌ No agent emails found in agent_dial_metrics';
    RETURN;
  END IF;
  
  RAISE NOTICE '🧪 Testing with agent: %', test_email;
  
  -- Call the function
  PERFORM update_live_call_boardt_stats_for_agent(test_email);
  
  RAISE NOTICE '✅ Function executed successfully';
  
  -- Check if live_call_boardt was updated
  SELECT 
    agent_email,
    today_dialed,
    today_reached,
    today_booked,
    updated_at
  FROM live_call_boardt
  WHERE agent_email = test_email;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ ERROR: %', SQLERRM;
END $$;

-- Step 4: Check what the EST date range is
SELECT * FROM get_today_est_range();

-- Step 5: Check if there are metrics in the EST date range
SELECT 
  COUNT(*) as total_metrics,
  COUNT(DISTINCT agent_email) as unique_agents,
  COUNT(DISTINCT CASE WHEN LOWER(event_type) = 'dial' THEN lead_phone END) as unique_dialed_phones,
  COUNT(DISTINCT CASE WHEN LOWER(event_type) = 'reach' THEN lead_phone END) as unique_reached_phones,
  COUNT(DISTINCT CASE WHEN LOWER(event_type) = 'booked' THEN lead_phone END) as unique_booked_phones
FROM agent_dial_metrics
WHERE event_timestamp >= (SELECT today_start FROM get_today_est_range())
  AND event_timestamp < (SELECT today_end FROM get_today_est_range())
  AND agent_email IS NOT NULL
  AND agent_email != ''
  AND lead_phone IS NOT NULL;

