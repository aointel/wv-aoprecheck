-- ============================================================================
-- TEST IF INSTANT PRESENTATION UPDATES ARE WORKING
-- ============================================================================

-- Step 1: Check if instant_presentation events exist in agent_dial_metrics
SELECT 
  'INSTANT PRESENTATION EVENTS IN agent_dial_metrics' as check_type,
  COUNT(*) as total_events,
  COUNT(DISTINCT agent_email) as distinct_agents
FROM agent_dial_metrics adm
WHERE adm.event_timestamp >= date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York'
  AND adm.event_timestamp < date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York' + interval '1 day'
  AND (
    LOWER(adm.event_type) = 'instant_presentation'
    OR LOWER(COALESCE(adm.disposition, '')) = 'instant_presentation'
  );

-- Step 2: Check what the function would calculate for instant_presentation
WITH today_range AS (
  SELECT 
    date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York' as today_start,
    date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York' + interval '1 day' as today_end
)
SELECT 
  'WHAT FUNCTION WOULD CALCULATE' as check_type,
  adm.agent_email,
  COUNT(DISTINCT adm.lead_phone) as calculated_instant_presentation,
  MIN(COALESCE(tcl.call_duration, adm.call_duration, 0)) as min_duration,
  MAX(COALESCE(tcl.call_duration, adm.call_duration, 0)) as max_duration
FROM agent_dial_metrics adm
LEFT JOIN twilio_call_logs tcl ON adm.call_sid = tcl.twilio_call_sid, today_range tr
WHERE adm.event_timestamp >= tr.today_start
  AND adm.event_timestamp < tr.today_end
  AND adm.agent_email IS NOT NULL
  AND adm.agent_email != ''
  AND adm.lead_phone IS NOT NULL
  AND (
    LOWER(adm.event_type) = 'instant_presentation'
    OR LOWER(COALESCE(adm.disposition, '')) = 'instant_presentation'
  )
  AND COALESCE(tcl.call_duration, adm.call_duration, 0) > 900
GROUP BY adm.agent_email
ORDER BY calculated_instant_presentation DESC;

-- Step 3: Check what's currently in live_call_boardt
SELECT 
  'CURRENT live_call_boardt VALUES' as check_type,
  agent_email,
  today_dialed,
  today_reached,
  today_booked,
  today_instant_presentation,
  updated_at
FROM live_call_boardt
WHERE agent_email IN (
  SELECT DISTINCT agent_email
  FROM agent_dial_metrics
  WHERE event_timestamp >= date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York'
    AND event_timestamp < date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York' + interval '1 day'
    AND (
      LOWER(event_type) = 'instant_presentation'
      OR LOWER(COALESCE(disposition, '')) = 'instant_presentation'
    )
)
ORDER BY today_instant_presentation DESC;

-- Step 4: FORCE UPDATE
SELECT 
  'FORCING UPDATE' as action,
  update_live_call_boardt_stats_from_metrics() as result;

-- Step 5: Check again after update
SELECT 
  'AFTER UPDATE - live_call_boardt VALUES' as check_type,
  agent_email,
  today_dialed,
  today_reached,
  today_booked,
  today_instant_presentation,
  updated_at
FROM live_call_boardt
WHERE agent_email IN (
  SELECT DISTINCT agent_email
  FROM agent_dial_metrics
  WHERE event_timestamp >= date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York'
    AND event_timestamp < date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York' + interval '1 day'
    AND (
      LOWER(event_type) = 'instant_presentation'
      OR LOWER(COALESCE(disposition, '')) = 'instant_presentation'
    )
)
ORDER BY today_instant_presentation DESC;
