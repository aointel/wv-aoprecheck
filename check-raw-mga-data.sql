-- Check what's ACTUALLY in the database for recent sessions
SELECT 
  id,
  session_id,
  agent_first_name || ' ' || agent_last_name as agent_full_name,
  agent_mga_team,
  agent_rga_team,
  company_email,
  associate_id,
  created_at
FROM verification_sessions
WHERE created_at >= CURRENT_DATE - INTERVAL '2 days'
ORDER BY created_at DESC
LIMIT 20;

-- Check agent_hierarchy to see what the CORRECT MGA team should be
SELECT 
  agent_associate_id,
  agent_name,
  agent_email,
  mga_name,
  rga_name
FROM agent_hierarchy
WHERE agent_email IN (
  SELECT DISTINCT company_email 
  FROM verification_sessions 
  WHERE created_at >= CURRENT_DATE - INTERVAL '2 days'
)
ORDER BY agent_name;




