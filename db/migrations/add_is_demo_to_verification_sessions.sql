-- Add is_demo column to verification_sessions table
-- This flag identifies demo precheck sessions that should not appear in management views

ALTER TABLE verification_sessions 
ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT false;

-- Add index for filtering demo sessions
CREATE INDEX IF NOT EXISTS idx_verification_sessions_is_demo 
ON verification_sessions(is_demo) 
WHERE is_demo = false;

-- Add comment to column
COMMENT ON COLUMN verification_sessions.is_demo IS 'Flag to identify demo/training sessions. Demo sessions should not appear in AO Precheck Management.';

