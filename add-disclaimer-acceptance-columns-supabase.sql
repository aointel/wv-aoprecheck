-- ============================================================================
-- Add Disclaimer Acceptance Columns to agent_profiles Table (Supabase)
-- ============================================================================
-- Run this SQL in your Supabase SQL Editor to add disclaimer tracking columns
-- This ensures acceptances persist across browsers/devices
-- ============================================================================

-- Add VDP Missed Call Disclaimer acceptance timestamp
ALTER TABLE agent_profiles
ADD COLUMN IF NOT EXISTS vdp_missed_call_disclaimer_accepted_at TIMESTAMP WITH TIME ZONE;

-- Add Call Connector Pro Disclaimer acceptance timestamp
ALTER TABLE agent_profiles
ADD COLUMN IF NOT EXISTS call_connector_pro_disclaimer_accepted_at TIMESTAMP WITH TIME ZONE;

-- Optional: Add comments to document the columns
-- (Uncomment these if your Supabase instance supports COMMENT ON COLUMN)
-- COMMENT ON COLUMN agent_profiles.vdp_missed_call_disclaimer_accepted_at IS 'Timestamp when agent accepted the VDP missed call billing disclaimer - persists across browsers/devices';
-- COMMENT ON COLUMN agent_profiles.call_connector_pro_disclaimer_accepted_at IS 'Timestamp when agent accepted the Call Connector Pro disclaimer - persists across browsers/devices';

-- Create indexes for fast queries on disclaimer acceptance
CREATE INDEX IF NOT EXISTS idx_agent_profiles_vdp_disclaimer_accepted 
  ON agent_profiles (email, vdp_missed_call_disclaimer_accepted_at)
  WHERE vdp_missed_call_disclaimer_accepted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_agent_profiles_ccpro_disclaimer_accepted 
  ON agent_profiles (email, call_connector_pro_disclaimer_accepted_at)
  WHERE call_connector_pro_disclaimer_accepted_at IS NOT NULL;

-- ============================================================================
-- Verification Query (optional - run after migration to verify columns exist)
-- ============================================================================
-- SELECT 
--   column_name, 
--   data_type, 
--   is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'agent_profiles' 
--   AND column_name IN (
--     'vdp_missed_call_disclaimer_accepted_at',
--     'call_connector_pro_disclaimer_accepted_at'
--   )
-- ORDER BY column_name;
-- ============================================================================

