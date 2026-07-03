-- Queue position table: you update this; API reads position + total for Connect inbound panel
CREATE TABLE IF NOT EXISTS agent_que_position (
  agent_email TEXT PRIMARY KEY,
  position INTEGER NOT NULL DEFAULT 0,
  total_eligible INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE agent_que_position IS 'Queue position for Connect inbound; your process updates, API reads for PositionTracker.';
COMMENT ON COLUMN agent_que_position.position IS '1-based queue position (0 = not in queue).';
COMMENT ON COLUMN agent_que_position.total_eligible IS 'Total agents eligible in same queue (for progress bar).';
