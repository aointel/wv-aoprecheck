-- ============================================================================
-- FORCE UPDATE INSTANT PRESENTATIONS IN LIVE CALL BOARD
-- 
-- This script:
-- 1. Checks if instant_presentation events exist in agent_dial_metrics
-- 2. Forces recalculation of live_call_boardt for ALL agents
-- 3. Shows the updated counts
-- ============================================================================

-- Step 1: Check if instant_presentation events exist today
SELECT 
  'CHECK: Instant presentation events in agent_dial_metrics today' as check_type,
  COUNT(*) as total_events,
  COUNT(DISTINCT agent_email) as distinct_agents,
  COUNT(DISTINCT lead_phone) as distinct_phones
FROM agent_dial_metrics adm
WHERE adm.event_timestamp >= date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York'
  AND adm.event_timestamp < date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York' + interval '1 day'
  AND (
    LOWER(adm.event_type) = 'instant_presentation'
    OR LOWER(COALESCE(adm.disposition, '')) = 'instant_presentation'
  );

-- Step 2: Show which agents have instant_presentation events
SELECT 
  'AGENTS WITH INSTANT PRESENTATIONS TODAY' as info,
  agent_email,
  COUNT(*) as event_count,
  COUNT(DISTINCT lead_phone) as distinct_phones,
  MIN(call_duration) as min_duration,
  MAX(call_duration) as max_duration,
  AVG(call_duration)::integer as avg_duration
FROM agent_dial_metrics adm
WHERE adm.event_timestamp >= date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York'
  AND adm.event_timestamp < date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York' + interval '1 day'
  AND (
    LOWER(adm.event_type) = 'instant_presentation'
    OR LOWER(COALESCE(adm.disposition, '')) = 'instant_presentation'
  )
GROUP BY agent_email
ORDER BY event_count DESC;

-- Step 3: FORCE RECALCULATE live_call_boardt for ALL agents
SELECT 
  'RECALCULATING LIVE CALL BOARD FOR ALL AGENTS' as action,
  update_live_call_boardt_stats_from_metrics() as result;

-- Step 4: Show updated instant presentation counts in live_call_boardt
SELECT 
  'UPDATED LIVE CALL BOARD - INSTANT PRESENTATIONS' as info,
  agent_email,
  today_dialed,
  today_reached,
  today_booked,
  today_instant_presentation,
  updated_at
FROM live_call_boardt
WHERE today_instant_presentation > 0
ORDER BY today_instant_presentation DESC, today_booked DESC;

-- Step 5: Show ALL agents (even if 0) for comparison
SELECT 
  'ALL AGENTS - CURRENT COUNTS' as info,
  agent_email,
  today_dialed,
  today_reached,
  today_booked,
  today_instant_presentation,
  updated_at
FROM live_call_boardt
WHERE agent_email IN (
  SELECT DISTINCT owner_email
  FROM twilio_call_logs
  WHERE call_started_at >= date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York'
    AND call_started_at < date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York' + interval '1 day'
    AND owner_email IS NOT NULL
)
ORDER BY today_instant_presentation DESC, today_booked DESC, today_reached DESC;
