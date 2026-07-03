-- Create table to store persistent Whereby meeting rooms per agent
CREATE TABLE IF NOT EXISTS agent_whereby_sessions (
  id SERIAL PRIMARY KEY,
  agent_email TEXT NOT NULL UNIQUE,
  meeting_id TEXT NOT NULL,
  room_url TEXT NOT NULL,
  host_room_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  last_used_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups by email
CREATE INDEX IF NOT EXISTS idx_agent_whereby_email ON agent_whereby_sessions(agent_email);

-- Index for cleanup of expired sessions
CREATE INDEX IF NOT EXISTS idx_agent_whereby_expires ON agent_whereby_sessions(expires_at);

COMMENT ON TABLE agent_whereby_sessions IS 'Stores persistent Whereby meeting rooms per agent - each agent gets their own unique room';
COMMENT ON COLUMN agent_whereby_sessions.agent_email IS 'Agent email (unique) - each agent has ONE persistent room';
COMMENT ON COLUMN agent_whereby_sessions.meeting_id IS 'Whereby meeting ID extracted from room URL';
COMMENT ON COLUMN agent_whereby_sessions.room_url IS 'Full Whereby room URL for clients';
COMMENT ON COLUMN agent_whereby_sessions.host_room_url IS 'Host URL with controls for agent';
COMMENT ON COLUMN agent_whereby_sessions.expires_at IS 'When this meeting expires (typically 24 hours)';

