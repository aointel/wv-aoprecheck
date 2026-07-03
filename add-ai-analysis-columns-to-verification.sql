-- Add missing AI analysis columns to verification_sessions table
-- These are needed for the automated AI analysis scheduler to work

ALTER TABLE verification_sessions 
ADD COLUMN IF NOT EXISTS screenshot_url TEXT,
ADD COLUMN IF NOT EXISTS recording_url TEXT,
ADD COLUMN IF NOT EXISTS screenshot_validation JSONB,
ADD COLUMN IF NOT EXISTS audio_analysis JSONB,
ADD COLUMN IF NOT EXISTS agent_first_name TEXT,
ADD COLUMN IF NOT EXISTS agent_last_name TEXT,
ADD COLUMN IF NOT EXISTS agent_mga_team TEXT,
ADD COLUMN IF NOT EXISTS agent_rga_team TEXT,
ADD COLUMN IF NOT EXISTS associate_id INTEGER,
ADD COLUMN IF NOT EXISTS company_email TEXT,
ADD COLUMN IF NOT EXISTS ach_draw_date TEXT,
ADD COLUMN IF NOT EXISTS ach_draw_date_short TEXT,
ADD COLUMN IF NOT EXISTS client_approval_timestamp TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Set default 'PENDING' for existing sessions so scheduler can find them
UPDATE verification_sessions
SET screenshot_url = 'PENDING',
    recording_url = 'PENDING'
WHERE screenshot_url IS NULL
  AND recording_url IS NULL
  AND status = 'pending';

-- Add indexes for AI analysis queries
CREATE INDEX IF NOT EXISTS idx_verification_screenshot_analysis 
  ON verification_sessions(screenshot_url) 
  WHERE screenshot_validation IS NULL;

CREATE INDEX IF NOT EXISTS idx_verification_audio_analysis 
  ON verification_sessions(recording_url) 
  WHERE audio_analysis IS NULL;

-- Comment for documentation
COMMENT ON COLUMN verification_sessions.screenshot_url IS 'URL to screenshot for AI validation. Set to PENDING until uploaded.';
COMMENT ON COLUMN verification_sessions.recording_url IS 'URL to recording for AI analysis. Set to PENDING until uploaded.';
COMMENT ON COLUMN verification_sessions.screenshot_validation IS 'AI validation result from GPT-4 Vision';
COMMENT ON COLUMN verification_sessions.audio_analysis IS 'AI transcript analysis result from Whisper + GPT-4';

