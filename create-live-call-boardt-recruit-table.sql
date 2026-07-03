-- Create live_call_boardt_recruit table for recruit stats aggregation
-- This mirrors live_call_boardt but specifically for recruit metrics
-- Updated by cron jobs from agent_dial_metrics where source='outbound_dialer_recruit'

CREATE TABLE IF NOT EXISTS live_call_boardt_recruit (
  agent_email text PRIMARY KEY,
  agent_name text,
  status text DEFAULT 'offline',
  today_dialed integer DEFAULT 0,
  today_reached integer DEFAULT 0,
  today_booked integer DEFAULT 0,
  today_connects integer DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_live_call_boardt_recruit_agent_email ON live_call_boardt_recruit (agent_email);
CREATE INDEX IF NOT EXISTS idx_live_call_boardt_recruit_updated_at ON live_call_boardt_recruit (updated_at DESC);

-- Comments
COMMENT ON TABLE live_call_boardt_recruit IS 'Stats aggregation table for recruit leaderboard. Updated by cron jobs from agent_dial_metrics where source=outbound_dialer_recruit.';
COMMENT ON COLUMN live_call_boardt_recruit.agent_email IS 'Primary key - agent email address';
COMMENT ON COLUMN live_call_boardt_recruit.today_dialed IS 'Number of recruit calls dialed today (from agent_dial_metrics where source=outbound_dialer_recruit)';
COMMENT ON COLUMN live_call_boardt_recruit.today_reached IS 'Number of recruit calls reached/answered today';
COMMENT ON COLUMN live_call_boardt_recruit.today_booked IS 'Number of recruit appointments booked today';
COMMENT ON COLUMN live_call_boardt_recruit.today_connects IS 'Number of recruit VDP connects today (from vdp_calls where market=aorecruit)';
