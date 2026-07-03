-- ConnectNow Analytics Tables
-- Stores pre-calculated KPIs for ConnectNow Analytics Dashboard

-- Daily KPIs by Campaign
CREATE TABLE IF NOT EXISTS connectnow_daily_kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  campaign_id TEXT NOT NULL,
  market TEXT NOT NULL,
  campaign_type TEXT NOT NULL,
  
  -- KPI Metrics
  total_new INTEGER DEFAULT 0,
  connected INTEGER DEFAULT 0,
  transferred INTEGER DEFAULT 0,
  percent_transferred NUMERIC(5,2) DEFAULT 0,
  agent_answered INTEGER DEFAULT 0,
  percent_answered NUMERIC(5,2) DEFAULT 0,
  ring_duration_avg NUMERIC(10,2) DEFAULT 0,
  billed INTEGER DEFAULT 0,
  percent_billed NUMERIC(5,2) DEFAULT 0,
  missed_with_agent INTEGER DEFAULT 0,
  percent_missed_agent NUMERIC(5,2) DEFAULT 0,
  missed_no_agent INTEGER DEFAULT 0,
  percent_missed_no_agent NUMERIC(5,2) DEFAULT 0,
  total_missed INTEGER DEFAULT 0,
  percent_total_missed NUMERIC(5,2) DEFAULT 0,
  
  -- Billing Metrics (daily totals, not per campaign)
  precheck_billed INTEGER DEFAULT 0,              -- Pre-Check sessions with taalk_call_url for the day
  precheck_sign_ups INTEGER DEFAULT 0,            -- Pre-Check sessions created on this date
  call_connector_pro_active_accounts INTEGER DEFAULT 0,  -- Call Connector Pro active/trial accounts on this date
  call_connector_pro_sign_ups INTEGER DEFAULT 0,         -- Call Connector Pro subscriptions created on this date
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Unique constraint: one record per date/campaign combination
  UNIQUE(date, campaign_id)
);

-- Index for fast date range queries
CREATE INDEX IF NOT EXISTS idx_connectnow_daily_kpis_date ON connectnow_daily_kpis(date);
CREATE INDEX IF NOT EXISTS idx_connectnow_daily_kpis_campaign ON connectnow_daily_kpis(campaign_id);
CREATE INDEX IF NOT EXISTS idx_connectnow_daily_kpis_market ON connectnow_daily_kpis(market);

-- Weekly summary view (optional, can be calculated on the fly)
CREATE OR REPLACE VIEW connectnow_weekly_summary AS
SELECT 
  market,
  campaign_id,
  campaign_type,
  DATE_TRUNC('week', date) + INTERVAL '3 days' as week_start, -- Thursday
  COUNT(*) as days_in_week,
  SUM(total_new) as total_new,
  SUM(connected) as connected,
  SUM(transferred) as transferred,
  CASE 
    WHEN SUM(connected) > 0 THEN (SUM(transferred)::NUMERIC / SUM(connected)::NUMERIC) * 100
    ELSE 0
  END as percent_transferred,
  SUM(agent_answered) as agent_answered,
  CASE 
    WHEN SUM(total_new) > 0 THEN (SUM(agent_answered)::NUMERIC / SUM(total_new)::NUMERIC) * 100
    ELSE 0
  END as percent_answered,
  AVG(ring_duration_avg) as ring_duration_avg,
  SUM(billed) as billed,
  CASE 
    WHEN SUM(total_new) > 0 THEN (SUM(billed)::NUMERIC / SUM(total_new)::NUMERIC) * 100
    ELSE 0
  END as percent_billed,
  SUM(missed_with_agent) as missed_with_agent,
  CASE 
    WHEN SUM(total_new) > 0 THEN (SUM(missed_with_agent)::NUMERIC / SUM(total_new)::NUMERIC) * 100
    ELSE 0
  END as percent_missed_agent,
  SUM(missed_no_agent) as missed_no_agent,
  CASE 
    WHEN SUM(total_new) > 0 THEN (SUM(missed_no_agent)::NUMERIC / SUM(total_new)::NUMERIC) * 100
    ELSE 0
  END as percent_missed_no_agent,
  SUM(total_missed) as total_missed,
  CASE 
    WHEN SUM(total_new) > 0 THEN (SUM(total_missed)::NUMERIC / SUM(total_new)::NUMERIC) * 100
    ELSE 0
  END as percent_total_missed
FROM connectnow_daily_kpis
GROUP BY market, campaign_id, campaign_type, DATE_TRUNC('week', date) + INTERVAL '3 days';

-- Daily Billing Summary Table
-- Stores daily billing and sign-up metrics for Pre-Check and Call Connector Pro
CREATE TABLE IF NOT EXISTS connectnow_billing_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  
  -- Pre-Check Metrics (daily)
  precheck_billed INTEGER DEFAULT 0,        -- Completed verification sessions for the day
  precheck_sign_ups INTEGER DEFAULT 0,      -- New verification sessions created on this date
  
  -- Call Connector Pro Metrics (daily)
  call_connector_pro_active_accounts INTEGER DEFAULT 0,  -- Snapshot of active/trial accounts on this date
  call_connector_pro_sign_ups INTEGER DEFAULT 0,         -- New subscriptions created on this date
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for fast date range queries
CREATE INDEX IF NOT EXISTS idx_connectnow_billing_summary_date ON connectnow_billing_summary(date);

