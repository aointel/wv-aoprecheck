-- Real-time agent daily stats table
-- Single row per agent per day — incremented atomically on each event
CREATE TABLE IF NOT EXISTS agent_daily_stats (
  id              BIGSERIAL PRIMARY KEY,
  agent_email     TEXT NOT NULL,
  stat_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  dials           INTEGER NOT NULL DEFAULT 0,
  reached         INTEGER NOT NULL DEFAULT 0,
  booked          INTEGER NOT NULL DEFAULT 0,
  instants        INTEGER NOT NULL DEFAULT 0,
  sales           INTEGER NOT NULL DEFAULT 0,
  alp             NUMERIC(12,2) NOT NULL DEFAULT 0,
  plus            INTEGER NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT agent_daily_stats_unique UNIQUE (agent_email, stat_date)
);

CREATE INDEX IF NOT EXISTS idx_agent_daily_stats_email_date ON agent_daily_stats (agent_email, stat_date);
