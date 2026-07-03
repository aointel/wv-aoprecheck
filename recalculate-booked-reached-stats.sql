-- Recalculate booked and reached stats from agent_dial_metrics
-- This script will update live_call_boardt with corrected counts

-- Step 1: First, update the SQL functions to use corrected logic (already done in update-live-call-board-from-agent-dial-metrics.sql)
-- The functions now count booked events without requiring call_status match

-- Step 2: Call the backfill function to recalculate all stats for today
SELECT backfill_live_call_boardt_stats_corrected();

-- Step 3: Also call the regular update function to ensure everything is synced
SELECT update_live_call_boardt_stats_from_metrics();

-- Step 2: Verify the counts match what's in agent_dial_metrics
-- Check a sample of agents to verify counts are correct
SELECT 
  lcb.agent_email,
  lcb.today_dialed,
  lcb.today_reached,
  lcb.today_booked,
  -- Compare with direct counts from agent_dial_metrics
  (
    SELECT COUNT(DISTINCT adm.lead_phone)
    FROM agent_dial_metrics adm
    WHERE adm.agent_email = lcb.agent_email
      AND adm.event_timestamp >= date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York'
      AND adm.event_timestamp < date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York' + interval '1 day'
      AND LOWER(adm.event_type) = 'dial'
  ) as actual_dialed,
  (
    SELECT COUNT(DISTINCT adm.lead_phone)
    FROM agent_dial_metrics adm
    WHERE adm.agent_email = lcb.agent_email
      AND adm.event_timestamp >= date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York'
      AND adm.event_timestamp < date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York' + interval '1 day'
      AND LOWER(adm.event_type) = 'reach'
  ) as actual_reached,
  (
    SELECT COUNT(DISTINCT adm.lead_phone)
    FROM agent_dial_metrics adm
    LEFT JOIN twilio_call_logs tcl ON adm.call_sid = tcl.twilio_call_sid
    WHERE adm.agent_email = lcb.agent_email
      AND adm.event_timestamp >= date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York'
      AND adm.event_timestamp < date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York' + interval '1 day'
      AND (LOWER(adm.event_type) = 'booked' OR LOWER(COALESCE(adm.disposition, '')) = 'booked')
      AND COALESCE(tcl.call_duration, adm.call_duration, 0) > 120
  ) as actual_booked
FROM live_call_boardt lcb
WHERE lcb.today_dialed > 0
  OR lcb.today_reached > 0
  OR lcb.today_booked > 0
ORDER BY lcb.today_booked DESC, lcb.today_reached DESC
LIMIT 20;

-- Step 3: Show any discrepancies
SELECT 
  lcb.agent_email,
  CASE 
    WHEN lcb.today_reached != (
      SELECT COUNT(DISTINCT adm.lead_phone)
      FROM agent_dial_metrics adm
      WHERE adm.agent_email = lcb.agent_email
        AND adm.event_timestamp >= date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York'
        AND adm.event_timestamp < date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York' + interval '1 day'
        AND LOWER(adm.event_type) = 'reach'
    ) THEN 'REACHED MISMATCH'
    WHEN lcb.today_booked != (
      SELECT COUNT(DISTINCT adm.lead_phone)
      FROM agent_dial_metrics adm
      LEFT JOIN twilio_call_logs tcl ON adm.call_sid = tcl.twilio_call_sid
      WHERE adm.agent_email = lcb.agent_email
        AND adm.event_timestamp >= date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York'
        AND adm.event_timestamp < date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York' + interval '1 day'
        AND (LOWER(adm.event_type) = 'booked' OR LOWER(COALESCE(adm.disposition, '')) = 'booked')
        AND COALESCE(tcl.call_duration, adm.call_duration, 0) > 120
    ) THEN 'BOOKED MISMATCH'
    ELSE 'OK'
  END as status,
  lcb.today_reached as board_reached,
  (
    SELECT COUNT(DISTINCT adm.lead_phone)
    FROM agent_dial_metrics adm
    WHERE adm.agent_email = lcb.agent_email
      AND adm.event_timestamp >= date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York'
      AND adm.event_timestamp < date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York' + interval '1 day'
      AND LOWER(adm.event_type) = 'reach'
  ) as metrics_reached,
  lcb.today_booked as board_booked,
  (
    SELECT COUNT(DISTINCT adm.lead_phone)
    FROM agent_dial_metrics adm
    LEFT JOIN twilio_call_logs tcl ON adm.call_sid = tcl.twilio_call_sid
    WHERE adm.agent_email = lcb.agent_email
      AND adm.event_timestamp >= date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York'
      AND adm.event_timestamp < date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York' + interval '1 day'
      AND (LOWER(adm.event_type) = 'booked' OR LOWER(COALESCE(adm.disposition, '')) = 'booked')
      AND COALESCE(tcl.call_duration, adm.call_duration, 0) > 120
  ) as metrics_booked
FROM live_call_boardt lcb
WHERE lcb.today_reached > 0 OR lcb.today_booked > 0
HAVING 
  lcb.today_reached != (
    SELECT COUNT(DISTINCT adm.lead_phone)
    FROM agent_dial_metrics adm
    WHERE adm.agent_email = lcb.agent_email
      AND adm.event_timestamp >= date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York'
      AND adm.event_timestamp < date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York' + interval '1 day'
      AND LOWER(adm.event_type) = 'reach'
  )
  OR lcb.today_booked != (
    SELECT COUNT(DISTINCT adm.lead_phone)
    FROM agent_dial_metrics adm
    LEFT JOIN twilio_call_logs tcl ON adm.call_sid = tcl.twilio_call_sid
    WHERE adm.agent_email = lcb.agent_email
      AND adm.event_timestamp >= date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York'
      AND adm.event_timestamp < date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York' + interval '1 day'
      AND (LOWER(adm.event_type) = 'booked' OR LOWER(COALESCE(adm.disposition, '')) = 'booked')
      AND COALESCE(tcl.call_duration, adm.call_duration, 0) > 120
  )
ORDER BY lcb.today_booked DESC;

-- Step 4: Show breakdown of booked events by duration
SELECT 
  agent_email,
  COUNT(DISTINCT lead_phone) as booked_count,
  COUNT(DISTINCT CASE WHEN COALESCE(tcl.call_duration, adm.call_duration, 0) > 120 THEN lead_phone END) as booked_over_2min,
  COUNT(DISTINCT CASE WHEN COALESCE(tcl.call_duration, adm.call_duration, 0) <= 120 THEN lead_phone END) as booked_under_2min,
  COUNT(DISTINCT CASE WHEN COALESCE(tcl.call_duration, adm.call_duration, 0) IS NULL OR COALESCE(tcl.call_duration, adm.call_duration, 0) = 0 THEN lead_phone END) as booked_no_duration
FROM agent_dial_metrics adm
LEFT JOIN twilio_call_logs tcl ON adm.call_sid = tcl.twilio_call_sid
WHERE (LOWER(adm.event_type) = 'booked' OR LOWER(COALESCE(adm.disposition, '')) = 'booked')
  AND adm.event_timestamp >= date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York'
  AND adm.event_timestamp < date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York' + interval '1 day'
GROUP BY agent_email
ORDER BY booked_count DESC;
