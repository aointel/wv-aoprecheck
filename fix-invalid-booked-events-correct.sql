-- CORRECT VERSION: Fix invalid booked events in agent_dial_metrics
-- This fixes ALL invalid booked events (not just today)

-- Step 1: First, UPDATE call_duration for events that can be fixed (have valid duration in twilio_call_logs)
-- This should happen BEFORE deleting, so we don't delete events that can be saved
UPDATE agent_dial_metrics adm
SET call_duration = tcl.call_duration
FROM twilio_call_logs tcl
WHERE adm.call_sid = tcl.twilio_call_sid
  AND (LOWER(adm.event_type) = 'booked' OR LOWER(COALESCE(adm.disposition, '')) = 'booked')
  AND (adm.call_duration IS NULL OR adm.call_duration <= 120)
  AND tcl.call_duration IS NOT NULL
  AND tcl.call_duration > 120;

-- Step 2: DELETE invalid booked events that cannot be fixed
-- Only delete if:
-- 1. No call_sid at all, OR
-- 2. Has call_sid but no valid duration in twilio_call_logs AND no valid duration in agent_dial_metrics
DELETE FROM agent_dial_metrics
WHERE (LOWER(event_type) = 'booked' OR LOWER(COALESCE(disposition, '')) = 'booked')
  AND (
    -- No call_sid at all
    call_sid IS NULL
    OR
    -- Has call_sid but duration is null or <= 120, and no valid duration in twilio_call_logs
    (
      (call_duration IS NULL OR call_duration <= 120)
      AND (
        call_sid IS NULL
        OR NOT EXISTS (
          SELECT 1 
          FROM twilio_call_logs tcl 
          WHERE tcl.twilio_call_sid = agent_dial_metrics.call_sid
            AND tcl.call_duration IS NOT NULL
            AND tcl.call_duration > 120
        )
      )
    )
  );

-- Step 3: Verify - show remaining booked events (should all be valid now)
SELECT 
  agent_email,
  COUNT(*) as booked_count,
  COUNT(DISTINCT lead_phone) as distinct_phones,
  MIN(COALESCE(tcl.call_duration, adm.call_duration)) as min_duration,
  MAX(COALESCE(tcl.call_duration, adm.call_duration)) as max_duration,
  COUNT(CASE WHEN COALESCE(tcl.call_duration, adm.call_duration, 0) <= 120 THEN 1 END) as invalid_remaining,
  COUNT(CASE WHEN adm.call_sid IS NULL THEN 1 END) as null_call_sid_remaining
FROM agent_dial_metrics adm
LEFT JOIN twilio_call_logs tcl ON adm.call_sid = tcl.twilio_call_sid
WHERE (LOWER(adm.event_type) = 'booked' OR LOWER(COALESCE(adm.disposition, '')) = 'booked')
GROUP BY agent_email
HAVING COUNT(CASE WHEN COALESCE(tcl.call_duration, adm.call_duration, 0) <= 120 THEN 1 END) > 0
   OR COUNT(CASE WHEN adm.call_sid IS NULL THEN 1 END) > 0
ORDER BY booked_count DESC;

-- Step 4: Recalculate stats after cleanup
SELECT backfill_live_call_boardt_stats_corrected();
