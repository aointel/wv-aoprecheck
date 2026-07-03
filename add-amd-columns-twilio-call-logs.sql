-- ============================================================================
-- ADD AMD (Answering Machine Detection) COLUMNS TO twilio_call_logs
-- ============================================================================
-- 
-- This adds columns to store Twilio AMD results:
-- - answered_by: human, machine_start, fax, unknown
-- - amd_duration_ms: Machine detection duration in milliseconds
--
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Add answered_by column if it doesn't exist
ALTER TABLE twilio_call_logs
  ADD COLUMN IF NOT EXISTS answered_by TEXT;

-- Add amd_duration_ms column if it doesn't exist
ALTER TABLE twilio_call_logs
  ADD COLUMN IF NOT EXISTS amd_duration_ms INTEGER;

-- Add comments for documentation
COMMENT ON COLUMN twilio_call_logs.answered_by IS 'Twilio AMD result: human (answered by human), machine_start (answering machine detected), fax (fax machine), unknown (unable to determine)';
COMMENT ON COLUMN twilio_call_logs.amd_duration_ms IS 'Twilio MachineDetectionDuration in milliseconds - time taken to detect if call was answered by human or machine';

-- Create index on answered_by for filtering/querying
CREATE INDEX IF NOT EXISTS idx_twilio_call_logs_answered_by 
  ON twilio_call_logs(answered_by) 
  WHERE answered_by IS NOT NULL;

-- Verify columns were added
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'twilio_call_logs' 
  AND column_name IN ('answered_by', 'amd_duration_ms')
ORDER BY column_name;

-- Expected output:
-- answered_by | text | yes
-- amd_duration_ms | integer | yes
