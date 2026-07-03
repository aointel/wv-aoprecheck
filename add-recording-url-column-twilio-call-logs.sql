-- Add recording_url column to twilio_call_logs table
-- Store Supabase storage signed URL (or Twilio URL) for call recording.

ALTER TABLE twilio_call_logs 
ADD COLUMN IF NOT EXISTS recording_url TEXT;

COMMENT ON COLUMN twilio_call_logs.recording_url IS 'URL for call recording (Supabase storage signed URL or Twilio recording URL)';
