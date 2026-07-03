-- FIX REACHED CALCULATION - SIMPLE VERSION
-- This just counts event_type = 'reach' records directly from agent_dial_metrics

-- Drop and recreate the function with SIMPLE logic
DROP FUNCTION IF EXISTS update_live_call_boardt_stats_from_metrics() CASCADE;

CREATE OR REPLACE FUNCTION update_live_call_boardt_stats_from_metrics()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  today_start timestamptz;
  today_end timestamptz;
BEGIN
  -- Get today's date range in EST timezone
  today_start := date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York';
  today_end := today_start + interval '1 day';
  
  -- Update live_call_boardt with today's stats from agent_dial_metrics
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
    -- REACHED: Just count event_type = 'reach' records (exclude wrong_number)
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

-- Test it
SELECT update_live_call_boardt_stats_from_metrics();

-- Check results
SELECT 
  agent_email,
  today_dialed,
  today_reached,
  today_booked
FROM live_call_boardt
WHERE today_dialed > 0 OR today_reached > 0
ORDER BY today_reached DESC
LIMIT 10;
