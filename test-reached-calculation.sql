-- TEST REACHED CALCULATION
-- Run this to see what data exists and why reached might not be calculating

-- Check if reach events exist
SELECT 
  'REACH EVENTS' as check_type,
  COUNT(*) as total_count,
  COUNT(DISTINCT agent_email) as unique_agents,
  COUNT(DISTINCT lead_phone) as unique_phones
FROM agent_dial_metrics
WHERE LOWER(event_type) = 'reach'
  AND event_timestamp >= date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York'
  AND event_timestamp < date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York' + interval '1 day';

-- Check reach events with wrong_number disposition (should be excluded)
SELECT 
  'REACH EVENTS WITH WRONG_NUMBER' as check_type,
  COUNT(*) as count
FROM agent_dial_metrics
WHERE LOWER(event_type) = 'reach'
  AND LOWER(COALESCE(disposition, '')) IN ('wrong_number', 'wrong number', 'bad_number')
  AND event_timestamp >= date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York'
  AND event_timestamp < date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York' + interval '1 day';

-- Check dial events that should count as reached (fallback)
SELECT 
  'DIAL EVENTS THAT SHOULD COUNT AS REACHED' as check_type,
  COUNT(DISTINCT lead_phone) as unique_phones
FROM agent_dial_metrics adm
LEFT JOIN twilio_call_logs tcl ON adm.call_sid = tcl.twilio_call_sid
WHERE LOWER(adm.event_type) = 'dial'
  AND LOWER(COALESCE(adm.disposition, '')) NOT IN ('wrong_number', 'wrong number', 'bad_number', 'no_answer', 'no_answer_vm', 'no_answer_voicemail')
  AND (LOWER(COALESCE(adm.call_status, '')) = 'answered' 
       OR (LOWER(COALESCE(adm.call_status, '')) = 'completed' AND COALESCE(tcl.call_duration, adm.call_duration, 0) > 0))
  AND ((tcl.call_duration IS NOT NULL AND tcl.call_duration >= 30)
       OR (tcl.call_duration IS NULL AND adm.call_duration IS NOT NULL AND adm.call_duration >= 30))
  AND adm.event_timestamp >= date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York'
  AND adm.event_timestamp < date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York' + interval '1 day';

-- Check what the function would return for a specific agent (replace email)
SELECT 
  agent_email,
  COUNT(DISTINCT CASE WHEN LOWER(event_type) = 'dial' THEN lead_phone END) as dialed,
  COUNT(DISTINCT CASE 
    WHEN (
      (LOWER(event_type) = 'reach' 
        AND LOWER(COALESCE(disposition, '')) NOT IN ('wrong_number', 'wrong number', 'bad_number'))
      OR
      (LOWER(event_type) = 'dial' 
        AND LOWER(COALESCE(disposition, '')) NOT IN ('wrong_number', 'wrong number', 'bad_number', 'no_answer', 'no_answer_vm', 'no_answer_voicemail')
        AND (LOWER(COALESCE(call_status, '')) = 'answered' 
             OR (LOWER(COALESCE(call_status, '')) = 'completed' AND COALESCE(call_duration, 0) > 0))
        AND call_duration IS NOT NULL AND call_duration >= 30)
    )
    THEN lead_phone 
  END) as reached
FROM agent_dial_metrics
WHERE agent_email = 'REPLACE_WITH_AGENT_EMAIL'
  AND event_timestamp >= date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York'
  AND event_timestamp < date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York' + interval '1 day'
GROUP BY agent_email;
