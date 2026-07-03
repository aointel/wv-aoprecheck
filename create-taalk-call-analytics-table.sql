-- Taalk Call Analytics Table
-- Stores AI-powered analysis results for Taalk transfer calls (connects)
-- Similar to Chorus/Gong call scoring and evaluation

CREATE TABLE IF NOT EXISTS taalk_call_analytics (
  id BIGSERIAL PRIMARY KEY,
  
  -- Link to billing transaction (the connect/transfer)
  billing_transaction_id TEXT NOT NULL,
  
  -- Agent and call info
  agent_email TEXT NOT NULL,
  call_date TIMESTAMPTZ NOT NULL,
  taalk_call_id TEXT,
  call_duration INTEGER, -- Call duration in seconds
  
  -- Recording and transcript
  recording_url TEXT,
  transcript TEXT,
  transcript_source TEXT, -- 'taalk_api' | 'ai_transcription' | 'manual'
  
  -- AI Analysis (stored as JSONB for flexibility)
  ai_analysis JSONB,
  
  -- Overall call score (0-100)
  call_score NUMERIC(5, 2),
  
  -- Scorecard results (structured scoring like Chorus/Gong)
  scorecard_results JSONB,
  -- Structure:
  -- {
  --   "disclosure": { "score": 85, "notes": "...", "passed": true },
  --   "agendaBuyIn": { "score": 90, "notes": "...", "passed": true },
  --   "objectionHandling": { "score": 75, "notes": "...", "objections": ["price", "timing"] },
  --   "needsAssessment": { "score": 80, "notes": "...", "passed": true },
  --   "nextSteps": { "score": 88, "notes": "...", "clarity": "CLEAR" },
  --   "closingAbility": { "score": 70, "notes": "...", "passed": true },
  --   "overallScore": 81.33
  -- }
  
  -- Coaching and insights
  coaching_notes TEXT,
  key_topics TEXT[],
  objections_detected TEXT[],
  
  -- Sentiment and engagement
  sentiment_score NUMERIC(3, 2), -- -1.0 to 1.0
  sentiment_label TEXT, -- 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE'
  agent_talk_time_pct NUMERIC(5, 2), -- Percentage of call agent talked
  client_engagement_level TEXT, -- 'HIGH' | 'MEDIUM' | 'LOW'
  
  -- Call outcome prediction
  call_outcome TEXT, -- 'SOLD' | 'CALLBACK' | 'THINK' | 'NO_SHOW' | 'OBJECTION' | 'OTHER'
  call_outcome_confidence NUMERIC(3, 2), -- 0.0 to 1.0
  
  -- Compliance flags (like precheck compliance checklist)
  compliance_flags JSONB,
  -- Structure:
  -- {
  --   "disclosureRecorded": true,
  --   "properIntroduction": true,
  --   "needsAssessed": true,
  --   "objectionsAddressed": true,
  --   "nextStepsSet": true,
  --   "professionalTone": true
  -- }
  
  -- Key moments with timestamps
  key_moments JSONB,
  -- Structure: [{"timestamp": "0:15", "description": "Agent introduces themselves"}, ...]
  
  -- Analysis metadata
  analyzed_at TIMESTAMPTZ,
  analysis_model TEXT, -- 'gpt-4o-mini' | 'gpt-4' | etc.
  analysis_version TEXT, -- Version of analysis prompt/logic
  
  -- Status
  analysis_status TEXT DEFAULT 'pending', -- 'pending' | 'analyzing' | 'completed' | 'failed'
  analysis_error TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_taalk_call_analytics_billing_transaction_id 
  ON taalk_call_analytics(billing_transaction_id);

CREATE INDEX IF NOT EXISTS idx_taalk_call_analytics_agent_email 
  ON taalk_call_analytics(agent_email);

CREATE INDEX IF NOT EXISTS idx_taalk_call_analytics_call_date 
  ON taalk_call_analytics(call_date);

CREATE INDEX IF NOT EXISTS idx_taalk_call_analytics_taalk_call_id 
  ON taalk_call_analytics(taalk_call_id);

CREATE INDEX IF NOT EXISTS idx_taalk_call_analytics_analysis_status 
  ON taalk_call_analytics(analysis_status);

CREATE INDEX IF NOT EXISTS idx_taalk_call_analytics_call_score 
  ON taalk_call_analytics(call_score);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_taalk_call_analytics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_taalk_call_analytics_updated_at
  BEFORE UPDATE ON taalk_call_analytics
  FOR EACH ROW
  EXECUTE FUNCTION update_taalk_call_analytics_updated_at();

-- Comments for documentation
COMMENT ON TABLE taalk_call_analytics IS 'AI-powered call analytics for Taalk transfer calls (connects). Stores Chorus/Gong-style scorecard evaluations, sentiment analysis, and coaching insights.';
COMMENT ON COLUMN taalk_call_analytics.billing_transaction_id IS 'Foreign key to billing_transactions.id (the connect transaction)';
COMMENT ON COLUMN taalk_call_analytics.scorecard_results IS 'Structured scorecard with individual category scores (disclosure, agenda, objections, etc.)';
COMMENT ON COLUMN taalk_call_analytics.call_score IS 'Overall call quality score from 0-100, calculated from scorecard results';
COMMENT ON COLUMN taalk_call_analytics.sentiment_score IS 'Sentiment analysis score from -1.0 (negative) to 1.0 (positive)';
