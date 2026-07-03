-- Create candidate_journey_sessions table for tracking Virtual Overview progress
CREATE TABLE IF NOT EXISTS candidate_journey_sessions (
  id BIGSERIAL PRIMARY KEY,
  candidate_id INTEGER NOT NULL,
  video_section_1_watched BOOLEAN DEFAULT FALSE,
  video_section_2_watched BOOLEAN DEFAULT FALSE,
  question_1_answered BOOLEAN DEFAULT FALSE,
  question_2_answered BOOLEAN DEFAULT FALSE,
  question_3_answered BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Foreign key to recruit_candidates
  CONSTRAINT fk_candidate FOREIGN KEY (candidate_id) REFERENCES recruit_candidates(id) ON DELETE CASCADE,
  
  -- Ensure one session per candidate
  CONSTRAINT unique_candidate_session UNIQUE (candidate_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_candidate_journey_sessions_candidate_id ON candidate_journey_sessions(candidate_id);

-- Enable RLS
ALTER TABLE candidate_journey_sessions ENABLE ROW LEVEL SECURITY;

-- Policy to allow anyone to read (for the public journey page)
CREATE POLICY "Anyone can read journey sessions" ON candidate_journey_sessions
  FOR SELECT USING (true);

-- Policy to allow anyone to update (for the public journey page to track progress)
CREATE POLICY "Anyone can update journey sessions" ON candidate_journey_sessions
  FOR UPDATE USING (true);

-- Policy to allow anyone to insert (for when journey session is created)
CREATE POLICY "Anyone can insert journey sessions" ON candidate_journey_sessions
  FOR INSERT WITH CHECK (true);

-- Add auto-update timestamp trigger
CREATE OR REPLACE FUNCTION update_candidate_journey_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_candidate_journey_sessions_updated_at
    BEFORE UPDATE ON candidate_journey_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_candidate_journey_sessions_updated_at();

