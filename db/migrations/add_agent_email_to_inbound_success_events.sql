-- So Recent Connects can show [Eligible] when the viewer is the agent who took the call.
ALTER TABLE inbound_success_events
  ADD COLUMN IF NOT EXISTS agent_email TEXT;

CREATE INDEX IF NOT EXISTS idx_inbound_success_events_agent_email
  ON inbound_success_events(agent_email) WHERE agent_email IS NOT NULL;
