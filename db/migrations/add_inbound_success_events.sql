-- Recent successful inbound connections (when TaskRouter reservation is accepted and dequeued).
-- Used by the Success Viewer at the bottom of the incoming call panel for social proof.

CREATE TABLE IF NOT EXISTS inbound_success_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_sid TEXT,
  task_sid TEXT NOT NULL,
  reservation_sid TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  market TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '',
  source TEXT,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inbound_success_events_connected_at ON inbound_success_events(connected_at DESC);
