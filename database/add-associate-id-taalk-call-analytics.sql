-- Add associate_id to taalk_call_analytics for agent lookup (from customers/producerlist by agent_email)
ALTER TABLE taalk_call_analytics
  ADD COLUMN IF NOT EXISTS associate_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_taalk_call_analytics_associate_id ON taalk_call_analytics(associate_id);

COMMENT ON COLUMN taalk_call_analytics.associate_id IS 'Associate ID from customers/producerlist, resolved by agent_email';
