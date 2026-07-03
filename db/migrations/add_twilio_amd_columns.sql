-- Twilio AMD: store AnsweredBy and duration on twilio_call_logs (Supabase)
-- Run this in Supabase SQL editor for the twilio_call_logs table.

ALTER TABLE twilio_call_logs
  ADD COLUMN IF NOT EXISTS answered_by text,
  ADD COLUMN IF NOT EXISTS amd_duration_ms integer;

COMMENT ON COLUMN twilio_call_logs.answered_by IS 'Twilio AMD result: human, machine_start, fax, unknown';
COMMENT ON COLUMN twilio_call_logs.amd_duration_ms IS 'Twilio MachineDetectionDuration in milliseconds';
