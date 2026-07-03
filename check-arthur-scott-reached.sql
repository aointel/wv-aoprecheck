-- ============================================================================
-- Check Arthur Scott's Reached Statistics
-- ============================================================================
-- This query checks reached count for arthurscott@aoglobelife.com
-- Reached = calls where human contact was made (event_type = 'reach')
-- ============================================================================

-- Today's reached count
SELECT 
  'Today' as period,
  COUNT(DISTINCT lead_phone) as reached_count,
  COUNT(*) as total_reach_events
FROM agent_dial_metrics
WHERE agent_email = 'arthurscott@aoglobelife.com'
  AND event_type = 'reach'
  AND event_timestamp >= CURRENT_DATE
  AND event_timestamp < CURRENT_DATE + INTERVAL '1 day';

-- This week's reached count
SELECT 
  'This Week' as period,
  COUNT(DISTINCT lead_phone) as reached_count,
  COUNT(*) as total_reach_events
FROM agent_dial_metrics
WHERE agent_email = 'arthurscott@aoglobelife.com'
  AND event_type = 'reach'
  AND event_timestamp >= DATE_TRUNC('week', CURRENT_DATE)
  AND event_timestamp < DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '1 week';

-- This month's reached count
SELECT 
  'This Month' as period,
  COUNT(DISTINCT lead_phone) as reached_count,
  COUNT(*) as total_reach_events
FROM agent_dial_metrics
WHERE agent_email = 'arthurscott@aoglobelife.com'
  AND event_type = 'reach'
  AND event_timestamp >= DATE_TRUNC('month', CURRENT_DATE)
  AND event_timestamp < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month';

-- All-time reached count
SELECT 
  'All Time' as period,
  COUNT(DISTINCT lead_phone) as reached_count,
  COUNT(*) as total_reach_events
FROM agent_dial_metrics
WHERE agent_email = 'arthurscott@aoglobelife.com'
  AND event_type = 'reach';

-- ============================================================================
-- Detailed breakdown by date (last 7 days)
-- ============================================================================
SELECT 
  DATE(event_timestamp) as date,
  COUNT(DISTINCT lead_phone) as reached_count,
  COUNT(*) as total_reach_events
FROM agent_dial_metrics
WHERE agent_email = 'arthurscott@aoglobelife.com'
  AND event_type = 'reach'
  AND event_timestamp >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(event_timestamp)
ORDER BY date DESC;

-- ============================================================================
-- Check live_call_boardt for current today_reached value
-- ============================================================================
SELECT 
  agent_email,
  agent_name,
  today_reached,
  today_dialed,
  today_booked,
  updated_at
FROM live_call_boardt
WHERE agent_email = 'arthurscott@aoglobelife.com';

-- ============================================================================
-- Recent reached events (last 10)
-- ============================================================================
SELECT 
  event_timestamp,
  lead_phone,
  lead_name,
  disposition,
  call_duration,
  source
FROM agent_dial_metrics
WHERE agent_email = 'arthurscott@aoglobelife.com'
  AND event_type = 'reach'
ORDER BY event_timestamp DESC
LIMIT 10;

