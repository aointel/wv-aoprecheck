-- Ensure IP Analysis columns exist in verification_sessions table
-- Run this in Supabase SQL Editor if columns are missing

-- Add IP analysis JSONB column (stores full analysis result)
ALTER TABLE verification_sessions 
ADD COLUMN IF NOT EXISTS ip_analysis JSONB;

-- Add convenience columns for filtering/display
ALTER TABLE verification_sessions 
ADD COLUMN IF NOT EXISTS ip_flag_status TEXT CHECK (ip_flag_status IN ('valid', 'flagged', 'suspicious', 'critical', 'pending'));

ALTER TABLE verification_sessions 
ADD COLUMN IF NOT EXISTS ip_flag_reason TEXT;

-- Create index for filtering by IP flag status
CREATE INDEX IF NOT EXISTS idx_verification_sessions_ip_flag_status 
ON verification_sessions(ip_flag_status);

-- Verify the columns exist
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'verification_sessions' 
  AND column_name IN ('ip_analysis', 'ip_flag_status', 'ip_flag_reason')
ORDER BY column_name;

