-- STATISTICAL ANOMALY DETECTION SYSTEM TABLES
-- These tables support statistical anomaly detection for agent dial metrics
-- Replaces hard-coded throttling rules with statistical baselines

-- Table: agent_anomaly_baselines
-- Stores calculated baseline metrics (mean + standard deviation) per agent per metric type
CREATE TABLE IF NOT EXISTS agent_anomaly_baselines (
  id BIGSERIAL PRIMARY KEY,
  agent_email TEXT NOT NULL,
  metric_type TEXT NOT NULL, -- 'call_duration', 'disposition_frequency', 'completion_rate', 'action_interval'
  mean_value DECIMAL(10,2) NOT NULL,
  std_dev DECIMAL(10,2) NOT NULL,
  sample_size INTEGER NOT NULL,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  date_range_start TIMESTAMPTZ NOT NULL,
  date_range_end TIMESTAMPTZ NOT NULL,
  UNIQUE(agent_email, metric_type)
);

-- Table: agent_anomaly_violations
-- Tracks violations and progressive timeouts
CREATE TABLE IF NOT EXISTS agent_anomaly_violations (
  id BIGSERIAL PRIMARY KEY,
  agent_email TEXT NOT NULL,
  violation_type TEXT NOT NULL, -- 'call_duration', 'disposition_frequency', etc.
  violation_value DECIMAL(10,2) NOT NULL, -- Actual value that triggered violation
  baseline_mean DECIMAL(10,2) NOT NULL,
  baseline_std_dev DECIMAL(10,2) NOT NULL,
  deviation_count DECIMAL(10,2) NOT NULL, -- How many std devs above/below
  violation_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  action_taken TEXT NOT NULL, -- 'warning', 'timeout_10min', 'timeout_1hr', 'timeout_24hr'
  timeout_until TIMESTAMPTZ, -- When timeout expires (NULL for warnings)
  resolved_at TIMESTAMPTZ, -- When violation was resolved
  metadata JSONB -- Additional context (call_sid, lead_id, etc.)
);

-- Table: agent_timeouts
-- Tracks active timeouts for agents
CREATE TABLE IF NOT EXISTS agent_timeouts (
  id BIGSERIAL PRIMARY KEY,
  agent_email TEXT NOT NULL,
  timeout_type TEXT NOT NULL, -- 'dialing', 'disposition', 'all'
  timeout_until TIMESTAMPTZ NOT NULL,
  violation_count INTEGER NOT NULL DEFAULT 1, -- Which violation this is (1st, 2nd, 3rd, 4th)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_agent_anomaly_baselines_agent_email ON agent_anomaly_baselines(agent_email);
CREATE INDEX IF NOT EXISTS idx_agent_anomaly_baselines_metric_type ON agent_anomaly_baselines(metric_type);
CREATE INDEX IF NOT EXISTS idx_agent_anomaly_baselines_agent_metric ON agent_anomaly_baselines(agent_email, metric_type);

CREATE INDEX IF NOT EXISTS idx_agent_anomaly_violations_agent_email ON agent_anomaly_violations(agent_email);
CREATE INDEX IF NOT EXISTS idx_agent_anomaly_violations_timestamp ON agent_anomaly_violations(violation_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_agent_anomaly_violations_agent_date ON agent_anomaly_violations(agent_email, violation_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_agent_anomaly_violations_resolved ON agent_anomaly_violations(agent_email, resolved_at) WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_agent_timeouts_agent_email ON agent_timeouts(agent_email);
CREATE INDEX IF NOT EXISTS idx_agent_timeouts_timeout_until ON agent_timeouts(timeout_until);
CREATE INDEX IF NOT EXISTS idx_agent_timeouts_active ON agent_timeouts(agent_email, timeout_until) WHERE resolved_at IS NULL;

-- Comments for documentation
COMMENT ON TABLE agent_anomaly_baselines IS 'Stores statistical baselines (mean + std dev) for each agent metric type. Calculated from historical data (30-90 days).';
COMMENT ON TABLE agent_anomaly_violations IS 'Tracks all anomaly violations with progressive timeout actions (warning → 10min → 1hr → 24hr).';
COMMENT ON TABLE agent_timeouts IS 'Tracks active timeouts that block agent actions. Resolved automatically when timeout expires.';
