-- Add Taalk recording URL column to verification_sessions table in Supabase
ALTER TABLE verification_sessions 
ADD COLUMN IF NOT EXISTS taalk_call_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN verification_sessions.taalk_call_url IS 'Object storage URL for downloaded Taalk call recording (MP3 file)';
