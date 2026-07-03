-- ============================================================================
-- Add Recruit Disclaimer Acceptance Column to agent_profiles Table (Supabase)
-- ============================================================================
-- Run this SQL in your Supabase SQL Editor to add recruit disclaimer tracking
-- This is separate from the regular Call Connector Pro disclaimer for /connect
-- ============================================================================

-- Add Call Connector Pro Recruit Disclaimer acceptance timestamp
ALTER TABLE agent_profiles
ADD COLUMN IF NOT EXISTS call_connector_pro_recruit_disclaimer_accepted_at TIMESTAMP WITH TIME ZONE;

-- Optional: Add comment to document the column
-- (Uncomment if your Supabase instance supports COMMENT ON COLUMN)
-- COMMENT ON COLUMN agent_profiles.call_connector_pro_recruit_disclaimer_accepted_at IS 'Timestamp when agent accepted the Call Connector Pro Recruit disclaimer - persists across browsers/devices';

-- Create index for fast queries on recruit disclaimer acceptance
CREATE INDEX IF NOT EXISTS idx_agent_profiles_ccpro_recruit_disclaimer_accepted 
  ON agent_profiles (email, call_connector_pro_recruit_disclaimer_accepted_at)
  WHERE call_connector_pro_recruit_disclaimer_accepted_at IS NOT NULL;

-- ============================================================================
-- Verification Query (optional - run after migration to verify column exists)
-- ============================================================================
-- SELECT 
--   column_name, 
--   data_type, 
--   is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'agent_profiles' 
--   AND column_name = 'call_connector_pro_recruit_disclaimer_accepted_at';
-- ============================================================================

