-- Call Analytics: single Supabase TABLE (source of truth for all call analytics).
-- All call analytics data is written here; all APIs read from here only.

CREATE TABLE IF NOT EXISTS call_analytics (
  id BIGSERIAL PRIMARY KEY,
  analytics_id BIGINT UNIQUE NOT NULL,  -- taalk_call_analytics.id
  transaction_id TEXT UNIQUE NOT NULL, -- billing_transaction_id e.g. twilio-CAxxx
  taalk_call_id TEXT,
  transaction_date TIMESTAMPTZ NOT NULL,
  agent_email TEXT NOT NULL,
  agent_name TEXT,
  lead_name TEXT,
  lead_phone TEXT,
  market TEXT,
  recording_url TEXT,  -- only Supabase URLs stored
  transcript TEXT,
  call_duration INTEGER,
  call_score NUMERIC(5, 2),
  analysis_status TEXT DEFAULT 'pending',
  analyzed_at TIMESTAMPTZ,
  sentiment_label TEXT,
  call_outcome TEXT,
  ai_analysis JSONB,
  scorecard_results JSONB,
  coaching_notes TEXT,
  key_topics TEXT[],
  objections_detected TEXT[],
  sentiment_score NUMERIC(3, 2),
  agent_talk_time_pct NUMERIC(5, 2),
  client_engagement_level TEXT,
  call_outcome_confidence NUMERIC(3, 2),
  compliance_flags JSONB,
  key_moments JSONB,
  has_analysis BOOLEAN DEFAULT FALSE,
  type_label TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_call_analytics_transaction_id ON call_analytics(transaction_id);
CREATE INDEX IF NOT EXISTS idx_call_analytics_taalk_call_id ON call_analytics(taalk_call_id);
CREATE INDEX IF NOT EXISTS idx_call_analytics_transaction_date ON call_analytics(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_call_analytics_agent_email ON call_analytics(agent_email);
CREATE INDEX IF NOT EXISTS idx_call_analytics_analysis_status ON call_analytics(analysis_status);

COMMENT ON TABLE call_analytics IS 'Single source of truth for call analytics. All data written here; all APIs read from here only.';
