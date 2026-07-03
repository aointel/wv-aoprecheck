-- Create live_call_boardt table for leaderboard and stats
-- This table is similar to live_call_board but specifically for stats aggregation
-- It's updated by cron jobs from agent_dial_metrics

CREATE TABLE IF NOT EXISTS live_call_boardt (
  agent_email        text PRIMARY KEY,
  
  -- Agent Info
  agent_name         text,
  
  -- Status
  status             text DEFAULT 'offline',
  
  -- Today's Stats (calculated from agent_dial_metrics)
  today_dialed       integer DEFAULT 0,
  today_reached      integer DEFAULT 0,
  today_booked       integer DEFAULT 0,
  today_presentations integer DEFAULT 0,
  today_sales        integer DEFAULT 0,
  
  -- Timestamps
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_live_call_boardt_agent_email 
  ON live_call_boardt (agent_email);

CREATE INDEX IF NOT EXISTS idx_live_call_boardt_updated_at 
  ON live_call_boardt (updated_at DESC);

-- Comments
COMMENT ON TABLE live_call_boardt IS 'Stats aggregation table for leaderboard. Updated by cron jobs from agent_dial_metrics.';
COMMENT ON COLUMN live_call_boardt.agent_email IS 'Primary key - agent email address';
COMMENT ON COLUMN live_call_boardt.today_dialed IS 'Number of calls dialed today (from agent_dial_metrics)';
COMMENT ON COLUMN live_call_boardt.today_reached IS 'Number of calls reached/answered today (from agent_dial_metrics)';
COMMENT ON COLUMN live_call_boardt.today_booked IS 'Number of appointments booked today (from agent_dial_metrics)';

