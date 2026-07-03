-- Injected test pending reservations (shared across server instances so inject works on baa2).
-- POST inject-pending writes here; GET pending merges with in-memory TaskRouter assignments.

CREATE TABLE IF NOT EXISTS taskrouter_injected_pending (
  reservation_sid TEXT PRIMARY KEY,
  task_sid TEXT NOT NULL,
  worker_attributes TEXT NOT NULL DEFAULT '{}',
  task_attributes TEXT NOT NULL DEFAULT '{}',
  agent_email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_taskrouter_injected_pending_agent_email ON taskrouter_injected_pending(agent_email);
CREATE INDEX IF NOT EXISTS idx_taskrouter_injected_pending_created_at ON taskrouter_injected_pending(created_at);
