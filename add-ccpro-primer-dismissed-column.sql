-- Add column to track CCPro primer modal dismissal in agent_profiles table
-- This ensures dismissals persist across browsers/devices

ALTER TABLE agent_profiles
ADD COLUMN IF NOT EXISTS ccpro_primer_dismissed_at TIMESTAMP WITH TIME ZONE;

-- Add comment
COMMENT ON COLUMN agent_profiles.ccpro_primer_dismissed_at IS 'Timestamp when agent dismissed the Call Connector Pro primer modal - persists across browsers/devices';

-- Create index for fast queries
CREATE INDEX IF NOT EXISTS idx_agent_profiles_ccpro_primer_dismissed 
  ON agent_profiles (email, ccpro_primer_dismissed_at)
  WHERE ccpro_primer_dismissed_at IS NOT NULL;
