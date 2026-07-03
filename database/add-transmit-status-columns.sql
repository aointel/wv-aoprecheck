-- Add transmit_status columns to verification_sessions table
-- These are needed for the transmit functionality

ALTER TABLE verification_sessions 
ADD COLUMN IF NOT EXISTS transmit_status TEXT DEFAULT 'pending_transmit',
ADD COLUMN IF NOT EXISTS precheck_type TEXT DEFAULT 'live',
ADD COLUMN IF NOT EXISTS transmitted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS scheduled_delete_at TIMESTAMPTZ;

-- Set default for existing sessions
UPDATE verification_sessions
SET transmit_status = 'pending_transmit'
WHERE transmit_status IS NULL;

-- Add index for filtering transmitted sessions
CREATE INDEX IF NOT EXISTS idx_verification_transmit_status 
  ON verification_sessions(transmit_status);

COMMENT ON COLUMN verification_sessions.transmit_status IS 'pending_transmit | transmitted | scheduled_delete';
COMMENT ON COLUMN verification_sessions.precheck_type IS 'live | training | incomplete';
COMMENT ON COLUMN verification_sessions.transmitted_at IS 'When agent clicked Transmit';
COMMENT ON COLUMN verification_sessions.scheduled_delete_at IS 'Training/Incomplete: delete in 24h; Recover clears this';
