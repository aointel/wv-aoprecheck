-- Add associate_id to twilio_call_logs so we store the agent's associate ID with every call
-- Backend resolves from owner_email (customers / agent_profiles) and writes on every upsert
ALTER TABLE twilio_call_logs
  ADD COLUMN IF NOT EXISTS associate_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_twilio_call_logs_associate_id ON twilio_call_logs(associate_id) WHERE associate_id IS NOT NULL;

COMMENT ON COLUMN twilio_call_logs.associate_id IS 'Associate ID from customers/agent_profiles, resolved from owner_email when logging the call';
 