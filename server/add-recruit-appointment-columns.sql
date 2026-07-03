-- Add appointment columns to recruit_candidates table if they don't exist
-- These columns are used for scheduling appointments with candidates

-- Add appointment_date column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'recruit_candidates' 
    AND column_name = 'appointment_date'
  ) THEN
    ALTER TABLE recruit_candidates ADD COLUMN appointment_date TIMESTAMP;
  END IF;
END $$;

-- Add appointment_notes column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'recruit_candidates' 
    AND column_name = 'appointment_notes'
  ) THEN
    ALTER TABLE recruit_candidates ADD COLUMN appointment_notes TEXT;
  END IF;
END $$;

-- Add comment
COMMENT ON COLUMN recruit_candidates.appointment_date IS 'Scheduled appointment date and time for the candidate';
COMMENT ON COLUMN recruit_candidates.appointment_notes IS 'Optional notes about the appointment';

