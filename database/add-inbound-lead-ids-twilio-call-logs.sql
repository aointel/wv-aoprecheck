-- Add lead_id and taalk_lead_id to twilio_call_logs for 609 inbound calls
-- /incomingcall sets these from masterlead lookup so inbound call log is tied to the lead
ALTER TABLE twilio_call_logs ADD COLUMN IF NOT EXISTS lead_id TEXT;
ALTER TABLE twilio_call_logs ADD COLUMN IF NOT EXISTS taalk_lead_id TEXT;

CREATE INDEX IF NOT EXISTS idx_twilio_call_logs_taalk_lead_id
  ON twilio_call_logs(taalk_lead_id) WHERE taalk_lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_twilio_call_logs_lead_id
  ON twilio_call_logs(lead_id) WHERE lead_id IS NOT NULL;

COMMENT ON COLUMN twilio_call_logs.lead_id IS 'masterlead id for 609 inbound; set at /incomingcall from phone lookup';
COMMENT ON COLUMN twilio_call_logs.taalk_lead_id IS 'Taalk lead id for 609 inbound; set at /incomingcall from masterlead';
