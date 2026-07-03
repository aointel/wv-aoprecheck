-- SAFE VERSION: Fix invalid booked events in agent_dial_metrics
-- This version shows what will be deleted before actually deleting

-- Step 1: Show what will be deleted (run this first to review)
SELECT 
  id,
  agent_email,
  lead_phone,
  event_type,
  disposition,
  call_duration,
  call_sid,
  event_timestamp,
  CASE 
    WHEN call_sid IS NULL THEN 'NO CALL_SID'
    WHEN call_duration IS NULL THEN 'NULL DURATION'
    WHEN call_duration <= 120 THEN 'DURATION <= 120'
    ELSE 'OTHER'
  END as reason
FROM agent_dial_metrics adm
WHERE (LOWER(adm.event_type) = 'booked' OR LOWER(COALESCE(adm.disposition, '')) = 'booked')
  AND adm.event_timestamp >= date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York'
  AND adm.event_timestamp < date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York' + interval '1 day'
  AND (
    -- No call_sid at all
    call_sid IS NULL
    OR
    -- Duration is null or <= 120, and no valid duration in twilio_call_logs
    (
      (call_duration IS NULL OR call_duration <= 120)
      AND NOT EXISTS (
        SELECT 1 
        FROM twilio_call_logs tcl 
        WHERE tcl.twilio_call_sid = adm.call_sid
          AND tcl.call_duration > 120
      )
    )
  )
ORDER BY agent_email, event_timestamp DESC;

-- Step 2: Show summary of what will be deleted
SELECT 
  agent_email,
  COUNT(*) as records_to_delete,
  COUNT(DISTINCT lead_phone) as distinct_phones_affected
FROM agent_dial_metrics adm
WHERE (LOWER(adm.event_type) = 'booked' OR LOWER(COALESCE(adm.disposition, '')) = 'booked')
  AND adm.event_timestamp >= date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York'
  AND adm.event_timestamp < date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York' + interval '1 day'
  AND (
    call_sid IS NULL
    OR
    (
      (call_duration IS NULL OR call_duration <= 120)
      AND NOT EXISTS (
        SELECT 1 
        FROM twilio_call_logs tcl 
        WHERE tcl.twilio_call_sid = adm.call_sid
          AND tcl.call_duration > 120
      )
    )
  )
GROUP BY agent_email
ORDER BY records_to_delete DESC;

-- Step 3: Check for events that can be fixed (have valid duration in twilio_call_logs)
SELECT 
  adm.id,
  adm.agent_email,
  adm.lead_phone,
  adm.call_duration as current_duration,
  tcl.call_duration as twilio_duration,
  'CAN BE FIXED - UPDATE DURATION' as action
FROM agent_dial_metrics adm
INNER JOIN twilio_call_logs tcl ON adm.call_sid = tcl.twilio_call_sid
WHERE (LOWER(adm.event_type) = 'booked' OR LOWER(COALESCE(adm.disposition, '')) = 'booked')
  AND (adm.call_duration IS NULL OR adm.call_duration <= 120)
  AND tcl.call_duration > 120
  AND adm.event_timestamp >= date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York'
  AND adm.event_timestamp < date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York' + interval '1 day'
ORDER BY adm.agent_email, adm.event_timestamp DESC;

-- AFTER REVIEWING THE ABOVE, RUN THE ACTUAL FIX:
-- (Uncomment the DELETE and UPDATE statements below)

/*
-- Step 4: DELETE invalid booked events
DELETE FROM agent_dial_metrics
WHERE (LOWER(event_type) = 'booked' OR LOWER(COALESCE(disposition, '')) = 'booked')
  AND event_timestamp >= date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York'
  AND event_timestamp < date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York' + interval '1 day'
  AND (
    call_sid IS NULL
    OR
    (
      (call_duration IS NULL OR call_duration <= 120)
      AND NOT EXISTS (
        SELECT 1 
        FROM twilio_call_logs tcl 
        WHERE tcl.twilio_call_sid = agent_dial_metrics.call_sid
          AND tcl.call_duration > 120
      )
    )
  );

-- Step 5: UPDATE call_duration for events that can be fixed
UPDATE agent_dial_metrics adm
SET call_duration = tcl.call_duration
FROM twilio_call_logs tcl
WHERE adm.call_sid = tcl.twilio_call_sid
  AND (LOWER(adm.event_type) = 'booked' OR LOWER(COALESCE(adm.disposition, '')) = 'booked')
  AND (adm.call_duration IS NULL OR adm.call_duration <= 120)
  AND tcl.call_duration > 120
  AND adm.event_timestamp >= date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York'
  AND adm.event_timestamp < date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York' + interval '1 day';

-- Step 6: Recalculate stats
SELECT backfill_live_call_boardt_stats_corrected();
*/
