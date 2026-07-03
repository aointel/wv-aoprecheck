-- Add questionnaire answer columns to candidate_journey_sessions table
ALTER TABLE candidate_journey_sessions
ADD COLUMN IF NOT EXISTS questionnaire_stood_out TEXT,
ADD COLUMN IF NOT EXISTS questionnaire_good_fit TEXT,
ADD COLUMN IF NOT EXISTS questionnaire_licensing_investment TEXT;

