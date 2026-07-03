-- Add electron_session_id column to track Electron's custom session IDs
ALTER TABLE presentation_sessions 
ADD COLUMN IF NOT EXISTS electron_session_id TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_presentation_sessions_electron_id 
ON presentation_sessions(electron_session_id);

-- Update existing sessions to use their UUID as electron_session_id if empty
UPDATE presentation_sessions 
SET electron_session_id = id::text 
WHERE electron_session_id IS NULL;

