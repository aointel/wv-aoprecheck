-- Add is_demo column to verification_sessions table
-- This flag identifies demo precheck sessions that should not appear in management views
-- Run this SQL in Supabase SQL Editor or via migration

ALTER TABLE verification_sessions 
ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT false;

-- Add index for filtering demo sessions (only index non-demo sessions for performance)
CREATE INDEX IF NOT EXISTS idx_verification_sessions_is_demo 
ON verification_sessions(is_demo) 
WHERE is_demo = false;

-- Add comment to column
COMMENT ON COLUMN verification_sessions.is_demo IS 'Flag to identify demo/training sessions. Demo sessions should not appear in AO Precheck Management views.';

-- Verify the column was added
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'verification_sessions' 
AND column_name = 'is_demo';

