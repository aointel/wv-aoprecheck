-- =====================================================
-- Reset All Call Connector Pro Disclaimer Acceptances
-- =====================================================
-- This script clears all existing disclaimer acceptances
-- so all users will need to re-acknowledge the updated disclaimer

-- Clear all Call Connector Pro disclaimer acceptances
UPDATE agent_profiles
SET 
  call_connector_pro_disclaimer_accepted_at = NULL,
  updated_at = NOW()
WHERE call_connector_pro_disclaimer_accepted_at IS NOT NULL;

-- Also clear Call Connector Pro Recruit disclaimer acceptances (if needed)
UPDATE agent_profiles
SET 
  call_connector_pro_recruit_disclaimer_accepted_at = NULL,
  updated_at = NOW()
WHERE call_connector_pro_recruit_disclaimer_accepted_at IS NOT NULL;

-- Show count of affected records
SELECT 
  COUNT(*) FILTER (WHERE call_connector_pro_disclaimer_accepted_at IS NULL) as cleared_ccpro,
  COUNT(*) FILTER (WHERE call_connector_pro_recruit_disclaimer_accepted_at IS NULL) as cleared_ccpro_recruit,
  COUNT(*) as total_profiles
FROM agent_profiles;

-- Note: Users will also need to clear their localStorage
-- They can do this by clearing browser data, or the app will handle it
-- when they see the new disclaimer
