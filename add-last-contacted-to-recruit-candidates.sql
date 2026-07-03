-- Add last_contacted column to recruit_candidates table
-- This matches the masterlead.last_contacted pattern for tracking when candidates were last called

ALTER TABLE recruit_candidates 
ADD COLUMN IF NOT EXISTS last_contacted TIMESTAMP;

-- Add comment to document the column
COMMENT ON COLUMN recruit_candidates.last_contacted IS 'Timestamp of when the candidate was last contacted via call (similar to masterlead.last_contacted)';
