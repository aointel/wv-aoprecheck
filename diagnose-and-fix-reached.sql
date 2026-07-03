-- DIAGNOSE AND FIX REACHED CALCULATION
-- Run this to see what's wrong and fix it

-- Step 1: Check if reach events exist today
SELECT 
  'STEP 1: REACH EVENTS TODAY' as step,
  COUNT(*) as total_reach_events,
  COUNT(DISTINCT agent_email) as agents_with_reach,
  COUNT(DISTINCT lead_phone) as unique_phones_reached
FROM agent_dial_metrics
WHERE LOWER(event_type) = 'reach'
  AND event_timestamp >= date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York'
  AND event_timestamp < date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York' + interval '1 day';

-- Step 2: Check reach events with wrong_number (should be excluded)
SELECT 
  'STEP 2: REACH EVENTS WITH WRONG_NUMBER (EXCLUDED)' as step,
  COUNT(*) as count
FROM agent_dial_metrics
WHERE LOWER(event_type) = 'reach'
  AND LOWER(COALESCE(disposition, '')) IN ('wrong_number', 'wrong number', 'bad_number')
  AND event_timestamp >= date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York'
  AND event_timestamp < date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York' + interval '1 day';

-- Step 3: Check what the function SHOULD return (manual calculation)
SELECT 
  'STEP 3: MANUAL CALCULATION' as step,
  agent_email,
  COUNT(DISTINCT CASE WHEN LOWER(event_type) = 'dial' THEN lead_phone END) as should_dialed,
  COUNT(DISTINCT CASE 
    WHEN LOWER(event_type) = 'reach' 
      AND LOWER(COALESCE(disposition, '')) NOT IN ('wrong_number', 'wrong number', 'bad_number')
    THEN lead_phone 
  END) as should_reached,
  COUNT(DISTINCT CASE WHEN (LOWER(event_type) = 'booked' OR LOWER(COALESCE(disposition, '')) = 'booked') THEN lead_phone END) as should_booked
FROM agent_dial_metrics
WHERE event_timestamp >= date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York'
  AND event_timestamp < date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York' + interval '1 day'
  AND agent_email IS NOT NULL
  AND agent_email != ''
  AND lead_phone IS NOT NULL
GROUP BY agent_email
HAVING COUNT(DISTINCT CASE WHEN LOWER(event_type) = 'reach' THEN lead_phone END) > 0
ORDER BY should_reached DESC
LIMIT 10;

-- Step 4: Check what's currently in live_call_boardt
SELECT 
  'STEP 4: CURRENT LIVE_CALL_BOARDT VALUES' as step,
  agent_email,
  today_dialed,
  today_reached,
  today_booked,
  updated_at
FROM live_call_boardt
WHERE today_dialed > 0 OR today_reached > 0
ORDER BY today_reached DESC
LIMIT 10;

-- Step 5: FIX IT - Drop and recreate function with SIMPLE logic
DROP FUNCTION IF EXISTS update_live_call_boardt_stats_from_metrics() CASCADE;

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

-- Step 6: Run the function
SELECT update_live_call_boardt_stats_from_metrics();

-- Step 7: Verify it worked
SELECT 
  'STEP 7: AFTER FIX' as step,
  agent_email,
  today_dialed,
  today_reached,
  today_booked
FROM live_call_boardt
WHERE today_dialed > 0 OR today_reached > 0
ORDER BY today_reached DESC
LIMIT 10;
