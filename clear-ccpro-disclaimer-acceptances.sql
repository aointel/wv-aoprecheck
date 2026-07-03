-- Clear all Call Connector Pro disclaimer acceptances
-- This will reset the call_connector_pro_disclaimer_accepted_at column to NULL
-- Users will need to accept the disclaimer again after running this

UPDATE agent_profiles
SET call_connector_pro_disclaimer_accepted_at = NULL
WHERE call_connector_pro_disclaimer_accepted_at IS NOT NULL;

-- Verify the update
SELECT 
  COUNT(*) as total_profiles,
  COUNT(call_connector_pro_disclaimer_accepted_at) as accepted_count,
  COUNT(*) - COUNT(call_connector_pro_disclaimer_accepted_at) as cleared_count
FROM agent_profiles;

