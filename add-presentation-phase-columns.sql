-- Add missing columns to presentation_sessions table for real-time tracking

ALTER TABLE presentation_sessions 
ADD COLUMN IF NOT EXISTS current_phase JSONB,
ADD COLUMN IF NOT EXISTS client_data JSONB,
ADD COLUMN IF NOT EXISTS session_id VARCHAR(255) UNIQUE;

-- Populate session_id for existing rows (use id as session_id if null)
UPDATE presentation_sessions 
SET session_id = id::text 
WHERE session_id IS NULL;

-- Create index on session_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_presentation_sessions_session_id ON presentation_sessions(session_id);

-- Update the reference in presentation_screenshots to use session_id string
-- First add the new column
ALTER TABLE presentation_screenshots 
ADD COLUMN IF NOT EXISTS session_id_str VARCHAR(255);

-- Populate it from the existing session_id (UUID)
UPDATE presentation_screenshots ps
SET session_id_str = pres.session_id
FROM presentation_sessions pres
WHERE ps.session_id = pres.id;

-- Create index
CREATE INDEX IF NOT EXISTS idx_presentation_screenshots_session_id_str ON presentation_screenshots(session_id_str);

COMMENT ON COLUMN presentation_sessions.current_phase IS 'Current presentation phase from AI analysis: {phase, timestamp, confidence}';
COMMENT ON COLUMN presentation_sessions.client_data IS 'Extracted client data: {firstName, lastName, phone, city, state, leadType}';
COMMENT ON COLUMN presentation_sessions.session_id IS 'String session ID used by the tracker (UUID as string)';

