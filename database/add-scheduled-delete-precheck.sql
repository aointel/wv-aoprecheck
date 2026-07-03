-- Add scheduled_delete_at for Training/Incomplete transmit - session will be deleted in 24 hours
-- Recover button clears this to undo
ALTER TABLE verification_sessions ADD COLUMN IF NOT EXISTS scheduled_delete_at TIMESTAMPTZ;
COMMENT ON COLUMN verification_sessions.scheduled_delete_at IS 'When set, session is greyed out and scheduled for deletion in 24h. Recover clears this.';
