-- Fix invalid booked events in agent_dial_metrics
-- This script removes or corrects booked events that don't have proper duration validation

-- Step 1: Show what we're about to fix
SELECT 
  'INVALID BOOKED EVENTS' as issue_type,
  agent_email,
  COUNT(*) as invalid_count,
  COUNT(DISTINCT lead_phone) as distinct_phones,
  COUNT(CASE WHEN call_duration IS NULL THEN 1 END) as null_duration,
  COUNT(CASE WHEN call_duration <= 120 THEN 1 END) as under_2min,
  COUNT(CASE WHEN call_sid IS NULL THEN 1 END) as null_call_sid
FROM agent_dial_metrics adm
WHERE (LOWER(adm.event_type) = 'booked' OR LOWER(COALESCE(adm.disposition, '')) = 'booked')
  AND (
    adm.call_duration IS NULL 
    OR adm.call_duration <= 120
    OR adm.call_sid IS NULL
  )
  AND adm.event_timestamp >= date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York'
  AND adm.event_timestamp < date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York' + interval '1 day'
GROUP BY agent_email
ORDER BY invalid_count DESC;

-- Step 2: Check if there are matching twilio_call_logs with valid duration
SELECT 
  'BOOKED EVENTS WITH VALID DURATION IN TWILIO_LOGS' as check_type,
  COUNT(*) as count
FROM agent_dial_metrics adm
LEFT JOIN twilio_call_logs tcl ON adm.call_sid = tcl.twilio_call_sid
WHERE (LOWER(adm.event_type) = 'booked' OR LOWER(COALESCE(adm.disposition, '')) = 'booked')
  AND (adm.call_duration IS NULL OR adm.call_duration <= 120 OR adm.call_sid IS NULL)
  AND tcl.call_duration IS NOT NULL
  AND tcl.call_duration > 120
  AND adm.event_timestamp >= date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York'
  AND adm.event_timestamp < date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York' + interval '1 day';

-- Step 3: DELETE invalid booked events for ALL AGENTS (those without proper duration validation)
-- CRITICAL: This removes booked events that don't meet the >120 second requirement
-- This fixes the issue for oliviabergamo and everyone else with invalid booked events
-- Deletes both event_type='booked' AND event_type='dial' with disposition='booked' that are invalid
-- DELETES ALL RECORDS WHERE:
--   - disposition = 'booked' (or event_type = 'booked')
--   - AND (call_sid IS NULL OR call_duration IS NULL OR call_duration <= 120)
DELETE FROM agent_dial_metrics
WHERE (LOWER(event_type) = 'booked' OR LOWER(COALESCE(disposition, '')) = 'booked')
  AND event_timestamp >= date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York'
  AND event_timestamp < date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York' + interval '1 day'
  AND (
    -- CRITICAL: Delete if call_sid is NULL (no way to verify the call)
    call_sid IS NULL
    OR
    -- CRITICAL: Delete if call_duration is NULL or <= 120, UNLESS there's valid duration in twilio_call_logs
    (
      (call_duration IS NULL OR call_duration <= 120)
      AND (
        call_sid IS NULL
        OR NOT EXISTS (
          SELECT 1 
          FROM twilio_call_logs tcl 
          WHERE tcl.twilio_call_sid = agent_dial_metrics.call_sid
            AND tcl.call_duration > 120
        )
      )
    )
  );

-- Step 4: Update call_duration for ALL AGENTS - fix booked events that have valid duration in twilio_call_logs
UPDATE agent_dial_metrics adm
SET call_duration = tcl.call_duration
FROM twilio_call_logs tcl
WHERE adm.call_sid = tcl.twilio_call_sid
  AND (LOWER(adm.event_type) = 'booked' OR LOWER(COALESCE(adm.disposition, '')) = 'booked')
  AND (adm.call_duration IS NULL OR adm.call_duration <= 120)
  AND tcl.call_duration > 120
  AND adm.event_timestamp >= date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York'
  AND adm.event_timestamp < date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York' + interval '1 day';

-- Step 5: Verify the fix - show remaining booked events for ALL AGENTS (should all be valid now)
SELECT 
  'REMAINING BOOKED EVENTS (SHOULD ALL BE VALID)' as verification,
  agent_email,
  COUNT(*) as booked_count,
  COUNT(DISTINCT lead_phone) as distinct_phones,
  MIN(COALESCE(tcl.call_duration, adm.call_duration)) as min_duration,
  MAX(COALESCE(tcl.call_duration, adm.call_duration)) as max_duration,
  COUNT(CASE WHEN COALESCE(tcl.call_duration, adm.call_duration, 0) <= 120 THEN 1 END) as invalid_remaining
FROM agent_dial_metrics adm
LEFT JOIN twilio_call_logs tcl ON adm.call_sid = tcl.twilio_call_sid
WHERE (LOWER(adm.event_type) = 'booked' OR LOWER(COALESCE(adm.disposition, '')) = 'booked')
  AND adm.event_timestamp >= date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York'
  AND adm.event_timestamp < date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York' + interval '1 day'
GROUP BY agent_email
HAVING COUNT(CASE WHEN COALESCE(tcl.call_duration, adm.call_duration, 0) <= 120 THEN 1 END) > 0
ORDER BY booked_count DESC;

-- Step 6: Recalculate stats for ALL AGENTS after cleanup
SELECT backfill_live_call_boardt_stats_corrected();

-- Step 7: Show summary of fixed agents
SELECT 
  'SUMMARY AFTER FIX' as summary,
  COUNT(DISTINCT agent_email) as agents_with_booked,
  SUM(booked_count) as total_booked_events,
  SUM(distinct_phones) as total_distinct_phones
FROM (
  SELECT 
    agent_email,
    COUNT(*) as booked_count,
    COUNT(DISTINCT lead_phone) as distinct_phones
  FROM agent_dial_metrics adm
  LEFT JOIN twilio_call_logs tcl ON adm.call_sid = tcl.twilio_call_sid
  WHERE (LOWER(adm.event_type) = 'booked' OR LOWER(COALESCE(adm.disposition, '')) = 'booked')
    AND adm.event_timestamp >= date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York'
    AND adm.event_timestamp < date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York' + interval '1 day'
    AND COALESCE(tcl.call_duration, adm.call_duration, 0) > 120
  GROUP BY agent_email
) valid_booked;
