-- Add VDP Boost columns to user_credits table
-- This allows tracking of boost status and expiration

ALTER TABLE user_credits
ADD COLUMN IF NOT EXISTS vdp_boost_active BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS vdp_boost_expires_at TIMESTAMP WITH TIME ZONE;

-- Create index for faster boost status queries
CREATE INDEX IF NOT EXISTS idx_user_credits_boost_expires 
ON user_credits(vdp_boost_expires_at) 
WHERE vdp_boost_active = TRUE;

-- Add comment
COMMENT ON COLUMN user_credits.vdp_boost_active IS 'Whether VDP boost is currently active (max priority for 1 hour)';
COMMENT ON COLUMN user_credits.vdp_boost_expires_at IS 'When the VDP boost expires (1 hour after activation)';

