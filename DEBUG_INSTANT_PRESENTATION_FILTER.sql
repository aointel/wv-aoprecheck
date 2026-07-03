-- ============================================================================
-- DEBUG: Why are instant presentations not being counted?
-- ============================================================================

-- Check all instant_presentation events and their durations
WITH today_range AS (
  SELECT 
    date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York' as today_start,
    date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York' + interval '1 day' as today_end
)
SELECT 
  'ALL INSTANT_PRESENTATION EVENTS WITH DURATIONS' as check_type,
  adm.agent_email,
  adm.lead_phone,
  adm.call_sid,
  adm.call_duration as adm_duration,
  tcl.call_duration as tcl_duration,
  COALESCE(tcl.call_duration, adm.call_duration, 0) as final_duration,
  CASE 
    WHEN COALESCE(tcl.call_duration, adm.call_duration, 0) > 900 THEN '✅ WOULD COUNT'
    ELSE '❌ FILTERED OUT (< 900s)'
  END as status,
  adm.event_timestamp
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
ORDER BY adm.agent_email, final_duration DESC;

-- Check which agents have events that pass the filter
WITH today_range AS (
  SELECT 
    date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York' as today_start,
    date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York' + interval '1 day' as today_end
)
SELECT 
  'AGENTS WITH INSTANT_PRESENTATION (PASSING FILTER)' as check_type,
  adm.agent_email,
  COUNT(DISTINCT CASE WHEN COALESCE(tcl.call_duration, adm.call_duration, 0) > 900 THEN adm.lead_phone END) as would_count,
  COUNT(DISTINCT adm.lead_phone) as total_events,
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
GROUP BY adm.agent_email
ORDER BY would_count DESC, total_events DESC;
