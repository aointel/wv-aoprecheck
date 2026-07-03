-- Weekly Usage Tracking Table
-- Tracks agent activity: logins, online time, VDP connects, VDP usage, dials made

CREATE TABLE IF NOT EXISTS weekly_usage_stats (
  id SERIAL PRIMARY KEY,
  agent_email TEXT NOT NULL,
  agent_name TEXT,
  week_start_date DATE NOT NULL, -- Sunday of the week
  week_end_date DATE NOT NULL,   -- Saturday of the week
  
  -- Login tracking
  total_logins INTEGER DEFAULT 0,
  unique_login_days INTEGER DEFAULT 0, -- Days they logged in this week
  
  -- Online time tracking (in minutes)
  total_online_minutes INTEGER DEFAULT 0,
  last_activity_at TIMESTAMPTZ,
  
  -- VDP Activity
  vdp_connects_received INTEGER DEFAULT 0, -- Inbound VDP calls received
  vdp_total_minutes INTEGER DEFAULT 0,     -- Time spent on VDP calls
  
  -- Outbound Dialing
  total_dials_made INTEGER DEFAULT 0,      -- Calls dialed from Call Connector Pro
  total_call_minutes INTEGER DEFAULT 0,    -- Time spent on outbound calls
  
  -- Appointments & Outcomes
  appointments_scheduled INTEGER DEFAULT 0,
  sales_made INTEGER DEFAULT 0,
  total_alp DECIMAL(10, 2) DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one record per agent per week
  UNIQUE(agent_email, week_start_date)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_weekly_usage_agent_week ON weekly_usage_stats(agent_email, week_start_date);
CREATE INDEX IF NOT EXISTS idx_weekly_usage_week ON weekly_usage_stats(week_start_date);

-- Daily Activity Log (for calculating online time)
CREATE TABLE IF NOT EXISTS agent_activity_log (
  id SERIAL PRIMARY KEY,
  agent_email TEXT NOT NULL,
  activity_type TEXT NOT NULL, -- 'login', 'logout', 'heartbeat', 'page_view'
  activity_data JSONB,         -- Extra data like page visited, feature used, etc.
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  
  -- For calculating sessions
  session_id TEXT,
  ip_address TEXT
);

CREATE INDEX IF NOT EXISTS idx_activity_agent_time ON agent_activity_log(agent_email, timestamp);
CREATE INDEX IF NOT EXISTS idx_activity_type ON agent_activity_log(activity_type);
CREATE INDEX IF NOT EXISTS idx_activity_session ON agent_activity_log(session_id);

-- Function to get or create current week's stats
CREATE OR REPLACE FUNCTION get_current_week_stats(p_agent_email TEXT)
RETURNS weekly_usage_stats AS $$
DECLARE
  week_start DATE;
  week_end DATE;
  current_stats weekly_usage_stats;
BEGIN
  -- Get current week boundaries (Sunday to Saturday)
  week_start := DATE_TRUNC('week', CURRENT_DATE)::DATE; -- Sunday
  week_end := week_start + INTERVAL '6 days'; -- Saturday
  
  -- Get or create stats record
  INSERT INTO weekly_usage_stats (
    agent_email,
    week_start_date,
    week_end_date
  ) VALUES (
    p_agent_email,
    week_start,
    week_end
  )
  ON CONFLICT (agent_email, week_start_date) 
  DO UPDATE SET updated_at = NOW()
  RETURNING * INTO current_stats;
  
  RETURN current_stats;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE weekly_usage_stats IS 'Tracks weekly agent usage metrics for reporting and analytics';
COMMENT ON TABLE agent_activity_log IS 'Logs all agent activity for calculating online time and engagement';

