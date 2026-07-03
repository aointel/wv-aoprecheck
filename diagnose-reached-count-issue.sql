-- DIAGNOSTIC: Why is reached count so low?
-- Check if reach events are being logged correctly

-- Step 1: Check all event types in today's metrics
SELECT 
  LOWER(event_type) as event_type_lower,
  event_type as event_type_original,
  COUNT(*) as total_count,
  COUNT(DISTINCT lead_phone) as unique_phones,
  COUNT(DISTINCT agent_email) as unique_agents
FROM agent_dial_metrics
WHERE event_timestamp >= (SELECT today_start FROM get_today_est_range())
  AND event_timestamp < (SELECT today_end FROM get_today_est_range())
  AND agent_email IS NOT NULL
  AND agent_email != ''
  AND lead_phone IS NOT NULL
GROUP BY LOWER(event_type), event_type
ORDER BY total_count DESC;

-- Step 2: Check if there are reach events with different casing
SELECT 
  event_type,
  COUNT(*) as count,
  COUNT(DISTINCT lead_phone) as unique_phones
FROM agent_dial_metrics
WHERE event_timestamp >= (SELECT today_start FROM get_today_est_range())
  AND event_timestamp < (SELECT today_end FROM get_today_est_range())
  AND agent_email IS NOT NULL
  AND agent_email != ''
  AND lead_phone IS NOT NULL
  AND (LOWER(event_type) = 'reach' OR event_type ILIKE '%reach%')
GROUP BY event_type;

-- Step 3: Check dispositions that should have triggered reach events
SELECT 
  disposition,
  COUNT(*) as total_events,
  COUNT(DISTINCT lead_phone) as unique_phones,
  COUNT(DISTINCT agent_email) as unique_agents,
  array_agg(DISTINCT event_type) as event_types
FROM agent_dial_metrics
WHERE event_timestamp >= (SELECT today_start FROM get_today_est_range())
  AND event_timestamp < (SELECT today_end FROM get_today_est_range())
  AND agent_email IS NOT NULL
  AND agent_email != ''
  AND lead_phone IS NOT NULL
  AND disposition IS NOT NULL
  AND LOWER(disposition) IN (
    'contacted', 'connected', 'talked', 'qualified', 'interested', 
    'not_interested', 'transfer', 'appointment', 'booked', 
    'callback_scheduled', 'call_back', 'callback', 'sale'
  )
GROUP BY disposition
ORDER BY total_events DESC;

-- Step 4: Check if dial events with "reached" dispositions have corresponding reach events
SELECT 
  d.agent_email,
  d.lead_phone,
  d.disposition,
  d.event_timestamp as dial_timestamp,
  CASE WHEN r.id IS NOT NULL THEN 'YES' ELSE 'NO' END as has_reach_event,
  r.event_timestamp as reach_timestamp
FROM agent_dial_metrics d
LEFT JOIN agent_dial_metrics r 
  ON d.agent_email = r.agent_email
  AND d.lead_phone = r.lead_phone
  AND LOWER(r.event_type) = 'reach'
  AND r.event_timestamp >= (SELECT today_start FROM get_today_est_range())
  AND r.event_timestamp < (SELECT today_end FROM get_today_est_range())
WHERE d.event_timestamp >= (SELECT today_start FROM get_today_est_range())
  AND d.event_timestamp < (SELECT today_end FROM get_today_est_range())
  AND LOWER(d.event_type) = 'dial'
  AND d.disposition IS NOT NULL
  AND LOWER(d.disposition) IN (
    'contacted', 'connected', 'talked', 'qualified', 'interested', 
    'not_interested', 'transfer', 'appointment', 'booked', 
    'callback_scheduled', 'call_back', 'callback', 'sale'
  )
  AND d.agent_email IS NOT NULL
  AND d.agent_email != ''
  AND d.lead_phone IS NOT NULL
ORDER BY d.event_timestamp DESC
LIMIT 20;

-- Step 5: Count how many dials should have had reach events but don't
SELECT 
  COUNT(*) as dials_without_reach_events,
  COUNT(DISTINCT d.agent_email) as agents_affected,
  COUNT(DISTINCT d.lead_phone) as phones_affected
FROM agent_dial_metrics d
WHERE d.event_timestamp >= (SELECT today_start FROM get_today_est_range())
  AND d.event_timestamp < (SELECT today_end FROM get_today_est_range())
  AND LOWER(d.event_type) = 'dial'
  AND d.disposition IS NOT NULL
  AND LOWER(d.disposition) IN (
    'contacted', 'connected', 'talked', 'qualified', 'interested', 
    'not_interested', 'transfer', 'appointment', 'booked', 
    'callback_scheduled', 'call_back', 'callback', 'sale'
  )
  AND d.agent_email IS NOT NULL
  AND d.agent_email != ''
  AND d.lead_phone IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 
    FROM agent_dial_metrics r
    WHERE r.agent_email = d.agent_email
      AND r.lead_phone = d.lead_phone
      AND LOWER(r.event_type) = 'reach'
      AND r.event_timestamp >= (SELECT today_start FROM get_today_est_range())
      AND r.event_timestamp < (SELECT today_end FROM get_today_est_range())
  );

-- Step 6: Check call durations for dial events (should trigger reach if >= 15 seconds)
SELECT 
  CASE 
    WHEN call_duration IS NULL THEN 'NULL duration'
    WHEN call_duration >= 15 THEN '>= 15 seconds (should be reach)'
    ELSE '< 15 seconds'
  END as duration_category,
  COUNT(*) as count,
  COUNT(DISTINCT lead_phone) as unique_phones,
  COUNT(DISTINCT agent_email) as unique_agents
FROM agent_dial_metrics
WHERE event_timestamp >= (SELECT today_start FROM get_today_est_range())
  AND event_timestamp < (SELECT today_end FROM get_today_est_range())
  AND LOWER(event_type) = 'dial'
  AND agent_email IS NOT NULL
  AND agent_email != ''
  AND lead_phone IS NOT NULL
GROUP BY duration_category
ORDER BY count DESC;


