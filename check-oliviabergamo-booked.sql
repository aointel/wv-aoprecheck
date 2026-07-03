-- Check oliviabergamo@aoglobelife.com booked events
-- This agent has 72 booked which seems wrong

-- Step 1: Count all booked events for this agent today
SELECT 
  'TOTAL BOOKED EVENTS' as check_type,
  COUNT(*) as total_count,
  COUNT(DISTINCT lead_phone) as distinct_phones
FROM agent_dial_metrics adm
WHERE adm.agent_email = 'oliviabergamo@aoglobelife.com'
  AND (LOWER(adm.event_type) = 'booked' OR LOWER(COALESCE(adm.disposition, '')) = 'booked')
  AND adm.event_timestamp >= date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York'
  AND adm.event_timestamp < date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York' + interval '1 day';

-- Step 2: Break down by duration
SELECT 
  'BOOKED BY DURATION' as check_type,
  COUNT(*) as total,
  COUNT(CASE WHEN call_duration IS NULL THEN 1 END) as null_duration,
  COUNT(CASE WHEN call_duration <= 120 THEN 1 END) as under_2min,
  COUNT(CASE WHEN call_duration > 120 THEN 1 END) as over_2min,
  COUNT(CASE WHEN call_sid IS NULL THEN 1 END) as null_call_sid
FROM agent_dial_metrics adm
WHERE adm.agent_email = 'oliviabergamo@aoglobelife.com'
  AND (LOWER(adm.event_type) = 'booked' OR LOWER(COALESCE(adm.disposition, '')) = 'booked')
  AND adm.event_timestamp >= date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York'
  AND adm.event_timestamp < date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York' + interval '1 day';

-- Step 3: Check with twilio_call_logs join
SELECT 
  'BOOKED WITH TWILIO CHECK' as check_type,
  COUNT(*) as total,
  COUNT(CASE WHEN COALESCE(tcl.call_duration, adm.call_duration, 0) > 120 THEN 1 END) as valid_over_2min,
  COUNT(CASE WHEN COALESCE(tcl.call_duration, adm.call_duration, 0) <= 120 THEN 1 END) as invalid_under_2min,
  COUNT(CASE WHEN COALESCE(tcl.call_duration, adm.call_duration, 0) IS NULL OR COALESCE(tcl.call_duration, adm.call_duration, 0) = 0 THEN 1 END) as null_or_zero
FROM agent_dial_metrics adm
LEFT JOIN twilio_call_logs tcl ON adm.call_sid = tcl.twilio_call_sid
WHERE adm.agent_email = 'oliviabergamo@aoglobelife.com'
  AND (LOWER(adm.event_type) = 'booked' OR LOWER(COALESCE(adm.disposition, '')) = 'booked')
  AND adm.event_timestamp >= date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York'
  AND adm.event_timestamp < date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York' + interval '1 day';

-- Step 4: Show actual records with details
SELECT 
  id,
  lead_phone,
  event_type,
  disposition,
  call_duration,
  call_sid,
  event_timestamp,
  COALESCE(tcl.call_duration, adm.call_duration, 0) as effective_duration,
  CASE 
    WHEN adm.call_sid IS NULL THEN 'NO CALL_SID'
    WHEN COALESCE(tcl.call_duration, adm.call_duration, 0) IS NULL OR COALESCE(tcl.call_duration, adm.call_duration, 0) = 0 THEN 'NO DURATION'
    WHEN COALESCE(tcl.call_duration, adm.call_duration, 0) <= 120 THEN 'DURATION <= 120'
    ELSE 'VALID'
  END as status
FROM agent_dial_metrics adm
LEFT JOIN twilio_call_logs tcl ON adm.call_sid = tcl.twilio_call_sid
WHERE adm.agent_email = 'oliviabergamo@aoglobelife.com'
  AND (LOWER(adm.event_type) = 'booked' OR LOWER(COALESCE(adm.disposition, '')) = 'booked')
  AND adm.event_timestamp >= date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York'
  AND adm.event_timestamp < date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York' + interval '1 day'
ORDER BY event_timestamp DESC;

-- Step 5: Count distinct phones that should be counted (valid booked)
SELECT 
  'VALID BOOKED COUNT (DISTINCT PHONES)' as check_type,
  COUNT(DISTINCT adm.lead_phone) as valid_booked_count
FROM agent_dial_metrics adm
LEFT JOIN twilio_call_logs tcl ON adm.call_sid = tcl.twilio_call_sid
WHERE adm.agent_email = 'oliviabergamo@aoglobelife.com'
  AND (LOWER(adm.event_type) = 'booked' OR LOWER(COALESCE(adm.disposition, '')) = 'booked')
  AND adm.event_timestamp >= date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York'
  AND adm.event_timestamp < date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York' + interval '1 day'
  AND COALESCE(tcl.call_duration, adm.call_duration, 0) > 120;

-- Step 6: What's in live_call_boardt for this agent
SELECT 
  'LIVE CALL BOARD' as check_type,
  agent_email,
  today_dialed,
  today_reached,
  today_booked,
  updated_at
FROM live_call_boardt
WHERE agent_email = 'oliviabergamo@aoglobelife.com';
