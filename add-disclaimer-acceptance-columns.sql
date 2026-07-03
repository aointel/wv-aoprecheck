-- Add columns to track disclaimer acceptance in agent_profiles table
-- This ensures acceptances persist across browsers/devices

-- VDP Missed Call Disclaimer
ALTER TABLE agent_profiles
ADD COLUMN IF NOT EXISTS vdp_missed_call_disclaimer_accepted_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN agent_profiles.vdp_missed_call_disclaimer_accepted_at IS 'Timestamp when agent accepted the VDP missed call billing disclaimer - persists across browsers/devices';

-- Call Connector Pro Disclaimer
ALTER TABLE agent_profiles
ADD COLUMN IF NOT EXISTS call_connector_pro_disclaimer_accepted_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN agent_profiles.call_connector_pro_disclaimer_accepted_at IS 'Timestamp when agent accepted the Call Connector Pro disclaimer - persists across browsers/devices';

-- Create indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_agent_profiles_vdp_disclaimer_accepted 
  ON agent_profiles (email, vdp_missed_call_disclaimer_accepted_at)
  WHERE vdp_missed_call_disclaimer_accepted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_agent_profiles_ccpro_disclaimer_accepted 
  ON agent_profiles (email, call_connector_pro_disclaimer_accepted_at)
  WHERE call_connector_pro_disclaimer_accepted_at IS NOT NULL;

