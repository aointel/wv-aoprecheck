-- FIX: Allow to_number to be NULL or empty in twilio_call_logs table
-- This allows us to backfill to_number from Twilio API later

-- First, check if column exists and current definition
DO $$
BEGIN
  -- Check if to_number column exists
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'twilio_call_logs' 
    AND column_name = 'to_number'
  ) THEN
    -- Alter column to allow NULL
    ALTER TABLE twilio_call_logs 
    ALTER COLUMN to_number DROP NOT NULL;
    
    RAISE NOTICE '✅ to_number column updated to allow NULL';
  ELSE
    RAISE NOTICE '⚠️ to_number column does not exist';
  END IF;
END $$;

-- Also check from_number
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'twilio_call_logs' 
    AND column_name = 'from_number'
  ) THEN
    ALTER TABLE twilio_call_logs 
    ALTER COLUMN from_number DROP NOT NULL;
    
    RAISE NOTICE '✅ from_number column updated to allow NULL';
  END IF;
END $$;

-- Add parent_call_sid column if it doesn't exist (for linking parent/child calls)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'twilio_call_logs' 
    AND column_name = 'parent_call_sid'
  ) THEN
    ALTER TABLE twilio_call_logs 
    ADD COLUMN parent_call_sid VARCHAR(34);
    
    CREATE INDEX IF NOT EXISTS idx_twilio_call_logs_parent_call_sid 
    ON twilio_call_logs(parent_call_sid);
    
    RAISE NOTICE '✅ parent_call_sid column added';
  ELSE
    RAISE NOTICE 'ℹ️ parent_call_sid column already exists';
  END IF;
END $$;

-- Verify the changes
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'twilio_call_logs' 
AND column_name IN ('to_number', 'from_number', 'parent_call_sid')
ORDER BY column_name;
