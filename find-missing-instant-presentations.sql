-- ============================================================================
-- FIND MISSING INSTANT PRESENTATIONS
-- 
-- This script:
-- 1. Finds calls in twilio_call_logs today with duration > 900s (15 minutes)
-- 2. Checks if there's a corresponding instant_presentation event in agent_dial_metrics
-- 3. Identifies potential missing instant_presentation events
-- ============================================================================

-- Step 1: Get today's date range in EST
WITH today_range AS (
  SELECT 
    date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York' as today_start,
    date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York' + interval '1 day' as today_end
),
-- Step 2: Find all calls today with duration > 900s (15 minutes) - potential instant presentations
potential_instant_presentations AS (
  SELECT 
    tcl.twilio_call_sid,
    tcl.owner_email as agent_email,
    tcl.to_number as lead_phone,
    tcl.call_duration,
    tcl.call_status,
    tcl.call_started_at,
    tcl.call_ended_at,
    tcl.call_direction
  FROM twilio_call_logs tcl, today_range tr
  WHERE tcl.call_started_at >= tr.today_start
    AND tcl.call_started_at < tr.today_end
    AND tcl.owner_email IS NOT NULL
    AND tcl.owner_email != ''
    AND tcl.call_direction = 'outbound'
    AND tcl.call_duration IS NOT NULL
    AND tcl.call_duration > 900  -- Over 15 minutes
    AND tcl.to_number IS NOT NULL
    AND tcl.to_number != ''
    AND LOWER(COALESCE(tcl.call_status, '')) IN ('answered', 'completed', 'in-progress')
),
-- Step 3: Check if these calls have instant_presentation events in agent_dial_metrics
existing_instant_presentations AS (
  SELECT DISTINCT
    adm.lead_phone,
    adm.agent_email,
    adm.call_sid,
    adm.event_type,
    adm.disposition,
    adm.event_timestamp,
    adm.call_duration as adm_duration
  FROM agent_dial_metrics adm, today_range tr
  WHERE adm.event_timestamp >= tr.today_start
    AND adm.event_timestamp < tr.today_end
    AND (
      LOWER(adm.event_type) = 'instant_presentation'
      OR LOWER(COALESCE(adm.disposition, '')) = 'instant_presentation'
    )
)
-- Step 4: Find missing instant presentations (calls > 15min without corresponding event)
SELECT 
  pip.twilio_call_sid,
  pip.agent_email,
  pip.lead_phone,
  pip.call_duration,
  pip.call_status,
  pip.call_started_at,
  pip.call_ended_at,
  CASE 
    WHEN eip.lead_phone IS NOT NULL THEN '✅ HAS INSTANT_PRESENTATION EVENT'
    ELSE '❌ MISSING INSTANT_PRESENTATION EVENT'
  END as status,
  eip.event_type as existing_event_type,
  eip.disposition as existing_disposition,
  eip.event_timestamp as existing_event_timestamp,
  -- Check if masterlead has instant_presentation resolution
  ml.cnresolution as masterlead_resolution,
  ml.id as masterlead_id
FROM potential_instant_presentations pip
LEFT JOIN existing_instant_presentations eip 
  ON pip.lead_phone = eip.lead_phone 
  AND pip.agent_email = eip.agent_email
  AND pip.twilio_call_sid = eip.call_sid
LEFT JOIN masterlead ml 
  ON pip.lead_phone = ml.phone 
  AND pip.agent_email = ml.cn_email
  AND LOWER(COALESCE(ml.cnresolution, '')) = 'instant_presentation'
WHERE eip.lead_phone IS NULL  -- Only show missing ones
ORDER BY pip.call_duration DESC, pip.call_started_at DESC;

-- Summary: Count missing vs existing
SELECT 
  COUNT(*) as total_potential_instant_presentations,
  COUNT(CASE WHEN eip.lead_phone IS NOT NULL THEN 1 END) as has_event_in_dial_metrics,
  COUNT(CASE WHEN eip.lead_phone IS NULL THEN 1 END) as missing_from_dial_metrics,
  COUNT(CASE WHEN ml.cnresolution = 'instant_presentation' THEN 1 END) as has_masterlead_resolution
FROM potential_instant_presentations pip
LEFT JOIN existing_instant_presentations eip 
  ON pip.lead_phone = eip.lead_phone 
  AND pip.agent_email = eip.agent_email
  AND pip.twilio_call_sid = eip.call_sid
LEFT JOIN masterlead ml 
  ON pip.lead_phone = ml.phone 
  AND pip.agent_email = ml.cn_email
  AND LOWER(COALESCE(ml.cnresolution, '')) = 'instant_presentation';
