-- Add video progress tracking columns to candidate_journey_sessions table

ALTER TABLE candidate_journey_sessions 
ADD COLUMN IF NOT EXISTS current_video_chapter INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS video_progress_percent INTEGER DEFAULT 0;

-- Add helpful comments
COMMENT ON COLUMN candidate_journey_sessions.current_video_chapter IS '0 = Our Company, 1 = Compensation, 2 = Next Step';
COMMENT ON COLUMN candidate_journey_sessions.video_progress_percent IS 'Progress percentage within current chapter (0-100)';

