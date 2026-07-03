-- Add missing screenshot analysis columns to verification_sessions table
-- These columns track whether screenshot analysis has been completed and the confidence score

-- Add screenshot_analysis_complete column (tracks if analysis has been done)
ALTER TABLE verification_sessions 
ADD COLUMN IF NOT EXISTS screenshot_analysis_complete BOOLEAN DEFAULT false;

-- Add screenshot_analysis_confidence column (stores confidence score 0-1)
ALTER TABLE verification_sessions 
ADD COLUMN IF NOT EXISTS screenshot_analysis_confidence DECIMAL(3,2);

-- Add comments for documentation
COMMENT ON COLUMN verification_sessions.screenshot_analysis_complete IS 'Boolean flag indicating if screenshot AI analysis has been completed';
COMMENT ON COLUMN verification_sessions.screenshot_analysis_confidence IS 'Confidence score from AI screenshot analysis (0.00 to 1.00)';

-- Verify the columns were added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'verification_sessions' 
  AND column_name IN ('screenshot_analysis_complete', 'screenshot_analysis_confidence');
