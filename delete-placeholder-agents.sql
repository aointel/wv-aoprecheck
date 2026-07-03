-- Delete placeholder/fake agents from database tables
-- These are test/placeholder entries that shouldn't exist

-- Delete from live_call_boardt table
DELETE FROM live_call_boardt 
WHERE 
  LOWER(agent_name) IN ('josc', 'miwi', 'joes', 'unkn', 'unknown') OR
  LOWER(agent_email) LIKE 'josc@%' OR
  LOWER(agent_email) LIKE 'miwi@%' OR
  LOWER(agent_email) LIKE 'joes@%' OR
  LOWER(agent_email) LIKE 'unkn@%' OR
  agent_email NOT LIKE '%@aoglobelife.com';

-- Delete from agent_hierarchy table (if they exist there)
DELETE FROM agent_hierarchy 
WHERE 
  LOWER(agent_name) IN ('josc', 'miwi', 'joes', 'unkn', 'unknown') OR
  LOWER(agent_email) LIKE 'josc@%' OR
  LOWER(agent_email) LIKE 'miwi@%' OR
  LOWER(agent_email) LIKE 'joes@%' OR
  LOWER(agent_email) LIKE 'unkn@%' OR
  agent_email NOT LIKE '%@aoglobelife.com';

-- Delete from agent_dial_metrics (clean up any metrics for these fake agents)
DELETE FROM agent_dial_metrics 
WHERE 
  LOWER(agent_email) LIKE 'josc@%' OR
  LOWER(agent_email) LIKE 'miwi@%' OR
  LOWER(agent_email) LIKE 'joes@%' OR
  LOWER(agent_email) LIKE 'unkn@%' OR
  agent_email NOT LIKE '%@aoglobelife.com';

SELECT 'Placeholder agents deleted successfully' AS result;




