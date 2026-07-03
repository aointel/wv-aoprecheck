-- Call Analytics Transfers: TABLE (replaces VIEW that scanned 23M+ rows)
-- Dedicated table for transfer calls. Stays small (7-day retention). Fast queries.

DROP VIEW IF EXISTS call_analytics_transfers;

CREATE TABLE call_analytics_transfers (
  id BIGSERIAL PRIMARY KEY,
  taalk_call_analytics_id BIGINT,
  transaction_id TEXT UNIQUE NOT NULL,
  taalk_call_id TEXT,
  transaction_date TIMESTAMPTZ NOT NULL,
  agent_email TEXT,
  associate_id INTEGER,
  agent_name TEXT,
  lead_name TEXT,
  lead_phone TEXT,
  market TEXT,
  recording_url TEXT,  -- ONLY Supabase storage URLs. Never Twilio API or /api/ proxy URLs.
  transcript TEXT,
  call_duration INTEGER,
  call_score NUMERIC(5, 2),
  analysis_status TEXT DEFAULT 'pending',
  analysis_error TEXT,
  analyzed_at TIMESTAMPTZ,
  sentiment_label TEXT,
  call_outcome TEXT,
  outcome TEXT,
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_call_transfers_taalk_call_id_unique ON call_analytics_transfers(taalk_call_id) WHERE taalk_call_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_call_transfers_transaction_id ON call_analytics_transfers(transaction_id);
CREATE INDEX IF NOT EXISTS idx_call_transfers_taalk_call_id ON call_analytics_transfers(taalk_call_id);
CREATE INDEX IF NOT EXISTS idx_call_transfers_transaction_date ON call_analytics_transfers(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_call_transfers_agent_email ON call_analytics_transfers(agent_email);
CREATE INDEX IF NOT EXISTS idx_call_transfers_analysis_status ON call_analytics_transfers(analysis_status);

COMMENT ON COLUMN call_analytics_transfers.recording_url IS 'ONLY Supabase storage URLs. Never Twilio API URLs or /api/ proxy URLs.';
COMMENT ON TABLE call_analytics_transfers IS 'Call analytics transfer calls. Replaces view. Populated by sync job and scheduler write-through. 24-hour retention.';
