-- =====================================================
-- Add IP Analysis Columns to verification_sessions
-- =====================================================
-- These columns store the IP fraud analysis results
-- Similar to screenshot_validation and audio_analysis

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

-- Add comment explaining the columns
COMMENT ON COLUMN verification_sessions.ip_analysis IS 'JSONB storing full IP analysis including: isValid, flagStatus, confidence, reason, and details (sameIp, sameCity, sameRegion, distanceMiles, locations)';
COMMENT ON COLUMN verification_sessions.ip_flag_status IS 'Quick status for filtering: valid, flagged, suspicious, critical, or pending';
COMMENT ON COLUMN verification_sessions.ip_flag_reason IS 'Human-readable explanation of why session was flagged';

-- Update existing sessions with pending status where IP data exists but no analysis
UPDATE verification_sessions 
SET ip_flag_status = 'pending'
WHERE ip_flag_status IS NULL 
  AND (client_ip_address IS NOT NULL OR agent_ip_address IS NOT NULL);

-- Verify the columns were added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'verification_sessions' 
  AND column_name IN ('ip_analysis', 'ip_flag_status', 'ip_flag_reason');

