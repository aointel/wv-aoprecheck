-- ============================================================================
-- Detect Concurrent Logins (Same Account from Different IPs)
-- ============================================================================
-- This query finds agents who have multiple active sessions from different IPs
-- indicating potential account sharing or unauthorized access
-- ============================================================================

-- Find all agents with concurrent active sessions from different IPs
SELECT 
  agent_email,
  COUNT(DISTINCT (metadata->>'ip_address')) as unique_ip_count,
  COUNT(DISTINCT session_id) as active_session_count,
  ARRAY_AGG(DISTINCT (metadata->>'ip_address')) as ip_addresses,
  ARRAY_AGG(DISTINCT session_id) as session_ids,
  MAX(last_heartbeat_at) as most_recent_activity
FROM agent_sessions
WHERE 
  last_heartbeat_at >= NOW() - INTERVAL '5 minutes'  -- Active in last 5 minutes
  AND current_status IN ('active', 'idle', 'on_call', 'on_presentation', 'browsing')
  AND metadata->>'ip_address' IS NOT NULL
  AND metadata->>'ip_address' != 'unknown'
GROUP BY agent_email
HAVING COUNT(DISTINCT (metadata->>'ip_address')) > 1  -- Multiple different IPs
ORDER BY unique_ip_count DESC, most_recent_activity DESC;

-- ============================================================================
-- Detailed View: Show all sessions for agents with concurrent logins
-- ============================================================================
WITH concurrent_users AS (
  SELECT 
    agent_email,
    COUNT(DISTINCT (metadata->>'ip_address')) as unique_ip_count
  FROM agent_sessions
  WHERE 
    last_heartbeat_at >= NOW() - INTERVAL '5 minutes'
    AND current_status IN ('active', 'idle', 'on_call', 'on_presentation', 'browsing')
    AND metadata->>'ip_address' IS NOT NULL
    AND metadata->>'ip_address' != 'unknown'
  GROUP BY agent_email
  HAVING COUNT(DISTINCT (metadata->>'ip_address')) > 1
)
SELECT 
  s.agent_email,
  s.session_id,
  s.current_status,
  s.metadata->>'ip_address' as ip_address,
  s.metadata->>'user_agent' as user_agent,
  s.last_heartbeat_at,
  s.created_at,
  s.metadata->>'invalidated_by_concurrent_login' as was_invalidated,
  s.metadata->>'invalidated_at' as invalidated_at
FROM agent_sessions s
INNER JOIN concurrent_users cu ON s.agent_email = cu.agent_email
WHERE 
  s.last_heartbeat_at >= NOW() - INTERVAL '5 minutes'
  AND s.current_status IN ('active', 'idle', 'on_call', 'on_presentation', 'browsing')
ORDER BY s.agent_email, s.last_heartbeat_at DESC;

