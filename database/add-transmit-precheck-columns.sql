-- ============================================================================
-- Transmit Precheck Columns
-- 
-- Adds transmit workflow to verification_sessions. Agents must select
-- Live/Training and click Transmit before a session appears in AO Precheck Management.
-- ============================================================================

ALTER TABLE verification_sessions ADD COLUMN IF NOT EXISTS transmit_status TEXT DEFAULT 'pending_transmit';
ALTER TABLE verification_sessions ADD COLUMN IF NOT EXISTS precheck_type TEXT DEFAULT 'live';
ALTER TABLE verification_sessions ADD COLUMN IF NOT EXISTS transmitted_at TIMESTAMPTZ;

-- Backfill: ensure existing rows have pending_transmit
UPDATE verification_sessions SET transmit_status = 'pending_transmit' WHERE transmit_status IS NULL;
UPDATE verification_sessions SET precheck_type = 'live' WHERE precheck_type IS NULL;

COMMENT ON COLUMN verification_sessions.transmit_status IS 'pending_transmit or transmitted - only transmitted sessions show in AO Precheck Management';
COMMENT ON COLUMN verification_sessions.precheck_type IS 'live or training - agent selection when transmitting';
COMMENT ON COLUMN verification_sessions.transmitted_at IS 'When agent clicked Transmit';

SELECT 'Transmit precheck columns added' AS status;
