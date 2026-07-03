-- Add AI validation columns to verification_sessions table

-- Add screenshot_url if it doesn't exist
ALTER TABLE verification_sessions 
ADD COLUMN IF NOT EXISTS screenshot_url TEXT;

-- Add screenshot_validation jsonb column
ALTER TABLE verification_sessions 
ADD COLUMN IF NOT EXISTS screenshot_validation JSONB;

-- Add recording_url if it doesn't exist  
ALTER TABLE verification_sessions 
ADD COLUMN IF NOT EXISTS recording_url TEXT;

-- Add audio_analysis jsonb column
ALTER TABLE verification_sessions 
ADD COLUMN IF NOT EXISTS audio_analysis JSONB;

-- Add index for faster queries on validated screenshots
CREATE INDEX IF NOT EXISTS idx_verification_sessions_screenshot_validation 
ON verification_sessions USING GIN (screenshot_validation);

-- Add index for faster queries on audio analysis
CREATE INDEX IF NOT EXISTS idx_verification_sessions_audio_analysis 
ON verification_sessions USING GIN (audio_analysis);

-- Update existing sessions that have screenshot_path to populate screenshot_url
-- (assuming screenshot_path contains the Supabase storage path)
UPDATE verification_sessions 
SET screenshot_url = screenshot_path
WHERE screenshot_path IS NOT NULL 
  AND screenshot_url IS NULL;

COMMENT ON COLUMN verification_sessions.screenshot_validation IS 'AI validation results for uploaded screenshots (GPT-4o Vision analysis)';
COMMENT ON COLUMN verification_sessions.audio_analysis IS 'AI analysis results for call recordings (Whisper + GPT-4o)';

