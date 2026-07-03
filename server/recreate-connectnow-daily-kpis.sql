-- Recreate connectnow_daily_kpis table with all columns
-- Run this in Supabase SQL Editor if the table is missing columns

-- Drop the table if it exists (WARNING: This will delete all data!)
DROP TABLE IF EXISTS connectnow_daily_kpis CASCADE;

-- Create the table with all required columns
CREATE TABLE connectnow_daily_kpis (
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

-- Create indexes for fast queries
CREATE INDEX idx_connectnow_daily_kpis_date ON connectnow_daily_kpis(date);
CREATE INDEX idx_connectnow_daily_kpis_campaign ON connectnow_daily_kpis(campaign_id);
CREATE INDEX idx_connectnow_daily_kpis_market ON connectnow_daily_kpis(market);

-- Verify the table was created
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'connectnow_daily_kpis'
ORDER BY ordinal_position;

