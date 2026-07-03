-- Add ip_analysis_summary column to verification_sessions table
-- This column stores the summary text that displays in the hover card for the IP flag icon

ALTER TABLE verification_sessions
ADD COLUMN IF NOT EXISTS ip_analysis_summary TEXT;

COMMENT ON COLUMN verification_sessions.ip_analysis_summary IS 'Summary text displayed in hover card for IP flag icon - contains the full analysis reason';


