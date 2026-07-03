-- Fix twilio_call_logs table schema
-- Twilio Call SIDs are 34 characters long (CA followed by 32 hex chars)

ALTER TABLE twilio_call_logs 
ALTER COLUMN twilio_call_sid TYPE VARCHAR(50);

-- Also fix other columns that might be too short
ALTER TABLE twilio_call_logs 
ALTER COLUMN from_number TYPE VARCHAR(100);

ALTER TABLE twilio_call_logs 
ALTER COLUMN to_number TYPE VARCHAR(100);

ALTER TABLE twilio_call_logs 
ALTER COLUMN owner_email TYPE VARCHAR(255);

ALTER TABLE twilio_call_logs 
ALTER COLUMN agent_identity TYPE VARCHAR(255);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_twilio_call_logs_owner_email 
ON twilio_call_logs(owner_email);

CREATE INDEX IF NOT EXISTS idx_twilio_call_logs_created_at 
ON twilio_call_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_twilio_call_logs_call_status 
ON twilio_call_logs(call_status);

