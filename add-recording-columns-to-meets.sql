-- Add recording and conversation intelligence columns to meets table

ALTER TABLE meets 
ADD COLUMN IF NOT EXISTS recording_url TEXT,
ADD COLUMN IF NOT EXISTS recording_duration INTEGER,
ADD COLUMN IF NOT EXISTS transcript TEXT,
ADD COLUMN IF NOT EXISTS transcript_segments JSONB,
ADD COLUMN IF NOT EXISTS conversation_analysis JSONB;

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_meets_recording ON meets(recording_url);
CREATE INDEX IF NOT EXISTS idx_meets_transcript ON meets(transcript);

COMMENT ON COLUMN meets.recording_url IS 'URL to Whereby cloud recording (MP4)';
COMMENT ON COLUMN meets.recording_duration IS 'Meeting duration in seconds';
COMMENT ON COLUMN meets.transcript IS 'Full meeting transcript from Whisper';
COMMENT ON COLUMN meets.transcript_segments IS 'Timestamped transcript segments';
COMMENT ON COLUMN meets.conversation_analysis IS 'AI analysis: objections, talk time, outcome, coaching notes';

