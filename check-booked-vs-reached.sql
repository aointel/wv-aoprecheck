-- CHECK WHY BOOKED > REACHED
-- This will show the raw data causing the issue

-- Check for agents where booked > reached
SELECT 
  agent_email,
  today_dialed,
  today_reached,
  today_booked,
  (today_booked - today_reached) as booked_minus_reached
FROM live_call_boardt
WHERE today_booked > today_reached
ORDER BY (today_booked - today_reached) DESC;

-- For a specific agent, show all booked events vs reach events
-- Replace 'jesserusso@aoglobelife.com' with the agent you want to check
SELECT 
  'BOOKED EVENTS' as event_category,
  event_type,
  disposition,
  lead_phone,
  event_timestamp,
  call_status,
  call_duration
FROM agent_dial_metrics
WHERE agent_email = 'jesserusso@aoglobelife.com'
  AND (
    LOWER(event_type) = 'booked' 
    OR LOWER(COALESCE(disposition, '')) = 'booked'
  )
  AND event_timestamp >= date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York'
  AND event_timestamp < date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York' + interval '1 day'
ORDER BY event_timestamp DESC;

-- Check if there's a corresponding reach event for each booked phone
SELECT 
  'BOOKED WITHOUT REACH' as issue,
  adm.agent_email,
  adm.lead_phone,
  adm.event_timestamp as booked_timestamp,
  adm.event_type,
  adm.disposition,
  CASE WHEN reach.lead_phone IS NULL THEN 'NO REACH EVENT' ELSE 'HAS REACH EVENT' END as reach_status
FROM agent_dial_metrics adm
LEFT JOIN (
  SELECT DISTINCT agent_email, lead_phone
  FROM agent_dial_metrics
  WHERE LOWER(event_type) = 'reach'
    AND LOWER(COALESCE(disposition, '')) NOT IN ('wrong_number', 'wrong number', 'bad_number')
    AND event_timestamp >= date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York'
    AND event_timestamp < date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York' + interval '1 day'
) reach ON adm.agent_email = reach.agent_email AND adm.lead_phone = reach.lead_phone
WHERE (
  LOWER(adm.event_type) = 'booked' 
  OR LOWER(COALESCE(adm.disposition, '')) = 'booked'
)
AND adm.event_timestamp >= date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York'
AND adm.event_timestamp < date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York' + interval '1 day'
AND reach.lead_phone IS NULL
ORDER BY adm.agent_email, adm.event_timestamp DESC;
