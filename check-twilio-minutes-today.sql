-- Find agent who used most Twilio minutes today

-- From call_connector_tracker (outbound calls)
SELECT 
  agent_email,
  agent_name,
  SUM(duration) as total_seconds,
  ROUND(SUM(duration) / 60.0, 2) as total_minutes,
  COUNT(*) as total_calls
FROM call_connector_tracker
WHERE created_at >= CURRENT_DATE
  AND duration > 0
GROUP BY agent_email, agent_name
ORDER BY total_seconds DESC
LIMIT 10;

