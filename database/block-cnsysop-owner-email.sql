-- BLOCK cnsysop/unknown/system from EVER appearing in twilio_call_logs.owner_email
-- Nobody uses cnsysop for calls; it should never show up as agent attribution.
-- Run this in Supabase SQL Editor.

-- 1) Backfill: Null out any existing rows with bad owner_email (and agent_identity)
UPDATE twilio_call_logs
SET owner_email = NULL, agent_identity = NULL, updated_at = NOW()
WHERE LOWER(TRIM(owner_email)) IN (
  'cnsysop@aoglobelife.com',
  'unknown@aoglobelife.com',
  'system@aoglobelife.com',
  'unknown',
  ''
)
AND owner_email IS NOT NULL;

-- 2) Trigger: Null owner_email on INSERT/UPDATE if it's a bad value (safety net for any code path)
CREATE OR REPLACE FUNCTION twilio_call_logs_block_bad_owner_email()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.owner_email IS NOT NULL AND LOWER(TRIM(NEW.owner_email)) IN (
    'cnsysop@aoglobelife.com',
    'unknown@aoglobelife.com',
    'system@aoglobelife.com',
    'unknown',
    ''
  ) THEN
    NEW.owner_email := NULL;
    NEW.agent_identity := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_twilio_call_logs_block_bad_owner ON twilio_call_logs;
CREATE TRIGGER trg_twilio_call_logs_block_bad_owner
  BEFORE INSERT OR UPDATE OF owner_email, agent_identity ON twilio_call_logs
  FOR EACH ROW
  EXECUTE FUNCTION twilio_call_logs_block_bad_owner_email();
