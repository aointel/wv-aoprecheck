-- Add presentation lifecycle tracking columns

-- Add client_confirmed_at timestamp (when client presence is confirmed)
ALTER TABLE presentation_sessions 
ADD COLUMN IF NOT EXISTS client_confirmed_at TIMESTAMP WITH TIME ZONE;

-- Add phase_updated_at timestamp (last time phase changed)
ALTER TABLE presentation_sessions 
ADD COLUMN IF NOT EXISTS phase_updated_at TIMESTAMP WITH TIME ZONE;

-- Update status enum to include 'abandoned'
-- Note: If you get an error, you may need to drop and recreate the enum
-- ALTER TYPE presentation_status ADD VALUE IF NOT EXISTS 'abandoned';

-- For now, just use a check constraint
ALTER TABLE presentation_sessions
DROP CONSTRAINT IF EXISTS presentation_sessions_status_check;

ALTER TABLE presentation_sessions
ADD CONSTRAINT presentation_sessions_status_check 
CHECK (status IN ('active', 'completed', 'interrupted', 'abandoned'));

-- Add index for lifecycle queries
CREATE INDEX IF NOT EXISTS idx_presentations_active_status 
ON presentation_sessions(agent_email, status) 
WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_presentations_phase_updated 
ON presentation_sessions(phase_updated_at) 
WHERE status = 'active';

-- Comments
COMMENT ON COLUMN presentation_sessions.client_confirmed_at IS 'Timestamp when client presence was confirmed (reached intro_screen or beyond)';
COMMENT ON COLUMN presentation_sessions.phase_updated_at IS 'Timestamp of last phase transition';

