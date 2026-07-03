-- ============================================================================
-- 72-hour lead outcome enforcement
-- One row per (lead_id, agent_id). agent_id = agent email (lowercase).
-- ============================================================================

-- Lead outcomes: one row per (lead, agent)
CREATE TABLE IF NOT EXISTS lead_outcomes (
  id BIGSERIAL PRIMARY KEY,
  lead_id BIGINT NOT NULL,
  agent_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('UNRESOLVED', 'PENDING', 'RESCHEDULED', 'SALE', 'NOT_INTERESTED')),
  pending_cycles INT NOT NULL DEFAULT 0,
  status_updated_at TIMESTAMPTZ,
  appointment_at TIMESTAMPTZ,
  locked_final BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(lead_id, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_lead_outcomes_agent_id ON lead_outcomes(agent_id);
CREATE INDEX IF NOT EXISTS idx_lead_outcomes_status ON lead_outcomes(status);
CREATE INDEX IF NOT EXISTS idx_lead_outcomes_status_updated_at ON lead_outcomes(status_updated_at);

-- Agent lock state (enforced server-side)
CREATE TABLE IF NOT EXISTS agent_enforcement (
  agent_id TEXT PRIMARY KEY,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  locked_reason TEXT,
  locked_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE lead_outcomes IS '72h enforcement: one row per (lead_id, agent_id). status + pending_cycles + locked_final enforced server-side.';
COMMENT ON TABLE agent_enforcement IS 'Agent lock when they have leads needing update (status_updated_at > 72h).';
