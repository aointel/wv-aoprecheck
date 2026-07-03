-- Check if throttling is being enforced for ankitadas@aoglobelife.com
-- Count booked + callback events in the last hour

-- Get all booked events in last hour
SELECT 
  'booked' as event_type,
  COUNT(*) as count,
  ARRAY_AGG(DISTINCT lead_phone ORDER BY lead_phone) as unique_phones,
  MIN(event_timestamp) as earliest,
  MAX(event_timestamp) as latest
FROM agent_dial_metrics
WHERE agent_email = 'ankitadas@aoglobelife.com'
  AND event_type = 'booked'
  AND event_timestamp >= NOW() - INTERVAL '1 hour'
  AND event_timestamp < NOW();

-- Get all callback events in last hour
SELECT 
  'callback' as event_type,
  COUNT(*) as count,
  ARRAY_AGG(DISTINCT lead_phone ORDER BY lead_phone) as unique_phones,
  MIN(event_timestamp) as earliest,
  MAX(event_timestamp) as latest
FROM agent_dial_metrics
WHERE agent_email = 'ankitadas@aoglobelife.com'
  AND disposition IN ('callback', 'callback_scheduled', 'call_back')
  AND event_timestamp >= NOW() - INTERVAL '1 hour'
  AND event_timestamp < NOW();

-- Combined count (booked + callback)
SELECT 
  COUNT(*) as total_combined,
  COUNT(DISTINCT CASE WHEN event_type = 'booked' THEN lead_phone END) as unique_booked_phones,
  COUNT(DISTINCT CASE WHEN disposition IN ('callback', 'callback_scheduled', 'call_back') THEN lead_phone END) as unique_callback_phones
FROM agent_dial_metrics
WHERE agent_email = 'ankitadas@aoglobelife.com'
  AND (
    event_type = 'booked' 
    OR disposition IN ('callback', 'callback_scheduled', 'call_back')
  )
  AND event_timestamp >= NOW() - INTERVAL '1 hour'
  AND event_timestamp < NOW();

-- Detailed view: Show all booked/callback events in last hour with timestamps
SELECT 
  id,
  event_type,
  disposition,
  lead_phone,
  lead_name,
  event_timestamp,
  EXTRACT(EPOCH FROM (NOW() - event_timestamp)) / 60 as minutes_ago
FROM agent_dial_metrics
WHERE agent_email = 'ankitadas@aoglobelife.com'
  AND (
    event_type = 'booked' 
    OR disposition IN ('callback', 'callback_scheduled', 'call_back')
  )
  AND event_timestamp >= NOW() - INTERVAL '1 hour'
  AND event_timestamp < NOW()
ORDER BY event_timestamp DESC;

