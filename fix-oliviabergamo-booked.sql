-- Fix oliviabergamo@aoglobelife.com invalid booked events
-- Delete all invalid booked events (null duration, <= 120 seconds, or no call_sid)

-- Step 1: Show what will be deleted
SELECT 
  id,
  lead_phone,
  event_type,
  disposition,
  call_duration,
  call_sid,
  event_timestamp,
  CASE 
    WHEN call_sid IS NULL THEN 'NO CALL_SID - WILL DELETE'
    WHEN call_duration IS NULL THEN 'NULL DURATION - WILL DELETE'
    WHEN call_duration <= 120 THEN 'DURATION <= 120 - WILL DELETE'
    ELSE 'OTHER'
  END as reason
FROM agent_dial_metrics adm
WHERE adm.agent_email = 'oliviabergamo@aoglobelife.com'
  AND (LOWER(adm.event_type) = 'booked' OR LOWER(COALESCE(adm.disposition, '')) = 'booked')
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
ORDER BY event_timestamp DESC;

-- Step 2: DELETE invalid booked events for this agent
DELETE FROM agent_dial_metrics
WHERE agent_email = 'oliviabergamo@aoglobelife.com'
  AND (LOWER(event_type) = 'booked' OR LOWER(COALESCE(disposition, '')) = 'booked')
  AND event_timestamp >= date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York'
  AND event_timestamp < date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York' + interval '1 day'
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
        WHERE tcl.twilio_call_sid = agent_dial_metrics.call_sid
          AND tcl.call_duration > 120
      )
    )
  );

-- Step 3: Update duration for events that can be fixed (have valid duration in twilio_call_logs)
UPDATE agent_dial_metrics adm
SET call_duration = tcl.call_duration
FROM twilio_call_logs tcl
WHERE adm.agent_email = 'oliviabergamo@aoglobelife.com'
  AND adm.call_sid = tcl.twilio_call_sid
  AND (LOWER(adm.event_type) = 'booked' OR LOWER(COALESCE(adm.disposition, '')) = 'booked')
  AND (adm.call_duration IS NULL OR adm.call_duration <= 120)
  AND tcl.call_duration > 120
  AND adm.event_timestamp >= date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York'
  AND adm.event_timestamp < date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York' + interval '1 day';

-- Step 4: Verify - show remaining booked events (should all be valid now)
SELECT 
  'REMAINING BOOKED EVENTS (SHOULD ALL BE VALID)' as verification,
  COUNT(*) as total_count,
  COUNT(DISTINCT lead_phone) as distinct_phones,
  COUNT(CASE WHEN COALESCE(tcl.call_duration, adm.call_duration, 0) > 120 THEN 1 END) as valid_count,
  COUNT(CASE WHEN COALESCE(tcl.call_duration, adm.call_duration, 0) <= 120 THEN 1 END) as invalid_remaining
FROM agent_dial_metrics adm
LEFT JOIN twilio_call_logs tcl ON adm.call_sid = tcl.twilio_call_sid
WHERE adm.agent_email = 'oliviabergamo@aoglobelife.com'
  AND (LOWER(adm.event_type) = 'booked' OR LOWER(COALESCE(adm.disposition, '')) = 'booked')
  AND adm.event_timestamp >= date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York'
  AND adm.event_timestamp < date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York' + interval '1 day';

-- Step 5: Recalculate stats for this agent
SELECT update_live_call_boardt_stats_for_agent('oliviabergamo@aoglobelife.com');

-- Step 6: Show updated live call board
SELECT 
  agent_email,
  today_dialed,
  today_reached,
  today_booked,
  updated_at
FROM live_call_boardt
WHERE agent_email = 'oliviabergamo@aoglobelife.com';
