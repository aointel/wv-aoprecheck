-- Add onboarding completion tracking to agent_profiles

ALTER TABLE agent_profiles
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- Add index for quick lookups
CREATE INDEX IF NOT EXISTS idx_agent_profiles_onboarding ON agent_profiles(email, onboarding_completed);

-- Comment
COMMENT ON COLUMN agent_profiles.onboarding_completed IS 'Whether user has completed Userpilot walkthrough';
COMMENT ON COLUMN agent_profiles.onboarding_completed_at IS 'Timestamp when user completed onboarding';

-- System admins are auto-completed (skip onboarding)
UPDATE agent_profiles
SET onboarding_completed = true, onboarding_completed_at = NOW()
WHERE email IN (
  'cnsysop@aoglobelife.com',
  'richiealtig@aoglobelife.com',
  'dianabarreiro@aoglobelife.com',
  'danielesolomon@aoglobelife.com'
);

SELECT 'Onboarding tracking field added to agent_profiles' as result;

