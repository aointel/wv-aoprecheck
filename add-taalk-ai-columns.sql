-- Add transcript and AI summary columns to verification_sessions table
-- These store data fetched directly from Taalk API

-- TRANSCRIPT: Full conversation text
ALTER TABLE verification_sessions 
ADD COLUMN IF NOT EXISTS call_transcript TEXT;

-- AI SUMMARY: Full summary JSON from Taalk
ALTER TABLE verification_sessions 
ADD COLUMN IF NOT EXISTS taalk_ai_summary JSONB;

-- EXTRACTED SUMMARY FIELDS (for easy querying)
ALTER TABLE verification_sessions 
ADD COLUMN IF NOT EXISTS ai_quick_recap TEXT,
ADD COLUMN IF NOT EXISTS ai_next_steps TEXT,
ADD COLUMN IF NOT EXISTS ai_key_topics TEXT,
ADD COLUMN IF NOT EXISTS ai_sentiment_score INTEGER,
ADD COLUMN IF NOT EXISTS ai_user_refused_call BOOLEAN DEFAULT FALSE;

-- COMPLIANCE CHECKLIST FIELDS
ALTER TABLE verification_sessions 
ADD COLUMN IF NOT EXISTS compliance_agent_confirmed BOOLEAN,
ADD COLUMN IF NOT EXISTS compliance_contact_verified BOOLEAN,
ADD COLUMN IF NOT EXISTS compliance_premium_ok BOOLEAN,
ADD COLUMN IF NOT EXISTS compliance_medical_asked BOOLEAN,
ADD COLUMN IF NOT EXISTS compliance_meds_asked BOOLEAN,
ADD COLUMN IF NOT EXISTS compliance_legal_asked BOOLEAN,
ADD COLUMN IF NOT EXISTS compliance_needs_analysis BOOLEAN,
ADD COLUMN IF NOT EXISTS compliance_all_medical BOOLEAN,
ADD COLUMN IF NOT EXISTS compliance_info_accurate BOOLEAN,
ADD COLUMN IF NOT EXISTS compliance_ach_explained BOOLEAN,
ADD COLUMN IF NOT EXISTS compliance_client_satisfied BOOLEAN;

-- RESULT FIELDS
ALTER TABLE verification_sessions 
ADD COLUMN IF NOT EXISTS ai_result TEXT,
ADD COLUMN IF NOT EXISTS ai_result_passed BOOLEAN,
ADD COLUMN IF NOT EXISTS ai_red_flags TEXT,
ADD COLUMN IF NOT EXISTS ai_favorite_feature TEXT,
ADD COLUMN IF NOT EXISTS ai_preview TEXT;

-- INDEXES for common queries
CREATE INDEX IF NOT EXISTS idx_verification_has_transcript 
  ON verification_sessions(session_id) 
  WHERE call_transcript IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_verification_sentiment 
  ON verification_sessions(ai_sentiment_score) 
  WHERE ai_sentiment_score IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_verification_passed 
  ON verification_sessions(ai_result_passed) 
  WHERE ai_result_passed IS NOT NULL;

-- COMMENTS for documentation
COMMENT ON COLUMN verification_sessions.call_transcript IS 'Full call transcript from Taalk API with AI: and Customer: speaker labels';
COMMENT ON COLUMN verification_sessions.taalk_ai_summary IS 'Full AI summary JSON from Taalk /summary endpoint';
COMMENT ON COLUMN verification_sessions.ai_quick_recap IS 'Brief summary of the call';
COMMENT ON COLUMN verification_sessions.ai_next_steps IS 'Recommended next steps from AI';
COMMENT ON COLUMN verification_sessions.ai_key_topics IS 'Key topics discussed in the call';
COMMENT ON COLUMN verification_sessions.ai_sentiment_score IS 'Call sentiment rating 0-10';
COMMENT ON COLUMN verification_sessions.ai_result_passed IS 'TRUE if verification passed compliance check';
COMMENT ON COLUMN verification_sessions.ai_red_flags IS 'Any red flags identified by AI';
COMMENT ON COLUMN verification_sessions.ai_preview IS 'One-line preview of result: PASS/FAIL - Agent, Client, Premium, etc';

