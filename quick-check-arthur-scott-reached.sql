-- ============================================================================
-- Quick Check: Arthur Scott's Reached Statistics
-- ============================================================================
-- Email: arthurscott@aoglobelife.com
-- ============================================================================

-- TODAY'S REACHED COUNT
SELECT 
  COUNT(DISTINCT lead_phone) as today_reached,
  COUNT(*) as total_reach_events_today
FROM agent_dial_metrics
WHERE agent_email = 'arthurscott@aoglobelife.com'
  AND event_type = 'reach'
  AND event_timestamp >= CURRENT_DATE
  AND event_timestamp < CURRENT_DATE + INTERVAL '1 day';

-- CURRENT STATUS FROM LIVE CALL BOARD
SELECT 
  agent_email,
  agent_name,
  today_reached,
  today_dialed,
  today_booked,
  status,
  updated_at
FROM live_call_boardt
WHERE agent_email = 'arthurscott@aoglobelife.com';

