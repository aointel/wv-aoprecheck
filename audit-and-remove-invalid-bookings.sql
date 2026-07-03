-- Audit and remove invalid bookings (booked dispositions on calls < 35 seconds)
-- This script identifies and removes bookings that were made on calls shorter than 35 seconds
-- This prevents padding/gaming where agents mark short calls as "booked"

-- Step 1: Find all booked events with call duration < 35 seconds
-- Join with twilio_call_logs to get real call duration
SELECT 
  adm.id,
  adm.agent_email,
  adm.lead_phone,
  adm.event_timestamp,
  adm.disposition,
  adm.call_duration as adm_duration,
  tcl.call_duration as twilio_duration,
  COALESCE(tcl.call_duration, adm.call_duration, 0) as effective_duration,
  tcl.call_status,
  CASE 
    WHEN COALESCE(tcl.call_duration, adm.call_duration, 0) < 35 THEN 'INVALID - Duration < 35s'
    WHEN COALESCE(tcl.call_duration, adm.call_duration, 0) IS NULL THEN 'INVALID - No duration'
    ELSE 'VALID'
  END as validation_status
FROM agent_dial_metrics adm
LEFT JOIN twilio_call_logs tcl ON adm.call_sid = tcl.twilio_call_sid
WHERE (
  LOWER(adm.event_type) = 'booked' 
  OR LOWER(COALESCE(adm.disposition, '')) = 'booked'
)
AND COALESCE(tcl.call_duration, adm.call_duration, 0) < 35
ORDER BY adm.event_timestamp DESC;

-- Step 2: Delete invalid booked events (calls < 35 seconds)
-- WARNING: This will permanently delete these records
-- Run the SELECT query above first to review what will be deleted
DELETE FROM agent_dial_metrics
WHERE id IN (
  SELECT adm.id
  FROM agent_dial_metrics adm
  LEFT JOIN twilio_call_logs tcl ON adm.call_sid = tcl.twilio_call_sid
  WHERE (
    LOWER(adm.event_type) = 'booked' 
    OR LOWER(COALESCE(adm.disposition, '')) = 'booked'
  )
  AND COALESCE(tcl.call_duration, adm.call_duration, 0) < 35
);

-- Step 3: Also check for other non-exempt dispositions on short calls
-- Dispositions that should require >= 35 seconds (not wrong_number, no_answer, etc.)
SELECT 
  adm.id,
  adm.agent_email,
  adm.lead_phone,
  adm.event_timestamp,
  adm.disposition,
  adm.event_type,
  COALESCE(tcl.call_duration, adm.call_duration, 0) as effective_duration,
  CASE 
    WHEN LOWER(COALESCE(adm.disposition, '')) IN ('wrong_number', 'wrong number', 'bad_number', 'no_answer', 'no_answer_vm', 'no_answer_voicemail', 'busy', 'failed', 'voicemail', 'dnc', 'do_not_call') THEN 'EXEMPT'
    WHEN COALESCE(tcl.call_duration, adm.call_duration, 0) < 35 THEN 'INVALID - Duration < 35s'
    WHEN COALESCE(tcl.call_duration, adm.call_duration, 0) IS NULL THEN 'INVALID - No duration'
    ELSE 'VALID'
  END as validation_status
FROM agent_dial_metrics adm
LEFT JOIN twilio_call_logs tcl ON adm.call_sid = tcl.twilio_call_sid
WHERE LOWER(COALESCE(adm.disposition, '')) NOT IN ('wrong_number', 'wrong number', 'bad_number', 'no_answer', 'no_answer_vm', 'no_answer_voicemail', 'busy', 'failed', 'voicemail', 'dnc', 'do_not_call')
  AND LOWER(adm.event_type) IN ('booked', 'reach', 'instant_presentation')
  AND COALESCE(tcl.call_duration, adm.call_duration, 0) < 35
ORDER BY adm.event_timestamp DESC;

-- Step 4: Summary - Count invalid bookings by agent
SELECT 
  adm.agent_email,
  COUNT(*) as invalid_bookings,
  MIN(COALESCE(tcl.call_duration, adm.call_duration, 0)) as min_duration,
  MAX(COALESCE(tcl.call_duration, adm.call_duration, 0)) as max_duration,
  AVG(COALESCE(tcl.call_duration, adm.call_duration, 0)) as avg_duration
FROM agent_dial_metrics adm
LEFT JOIN twilio_call_logs tcl ON adm.call_sid = tcl.twilio_call_sid
WHERE (
  LOWER(adm.event_type) = 'booked' 
  OR LOWER(COALESCE(adm.disposition, '')) = 'booked'
)
AND COALESCE(tcl.call_duration, adm.call_duration, 0) < 35
GROUP BY adm.agent_email
ORDER BY invalid_bookings DESC;
