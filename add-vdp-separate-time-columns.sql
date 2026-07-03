-- Add separate VDP available time and call time columns to weekly_usage_stats
-- This allows us to track:
--   vdp_available_minutes: Time agents are online/waiting for calls
--   vdp_call_minutes: Time agents are actively on calls
--   vdp_total_minutes: Total VDP time (kept for backward compatibility)

-- Check if columns exist and add them if they don't
DO $$
BEGIN
  -- Add vdp_available_minutes column (time waiting for calls)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'weekly_usage_stats' 
    AND column_name = 'vdp_available_minutes'
  ) THEN
    ALTER TABLE weekly_usage_stats 
    ADD COLUMN vdp_available_minutes INTEGER DEFAULT 0;
    
    COMMENT ON COLUMN weekly_usage_stats.vdp_available_minutes IS 
      'Time in minutes agent was online/available waiting for VDP calls (from agent_availability_tracking.total_available_time)';
    
    RAISE NOTICE 'Added vdp_available_minutes column';
  ELSE
    RAISE NOTICE 'Column vdp_available_minutes already exists';
  END IF;

  -- Add vdp_call_minutes column (time actively on calls)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'weekly_usage_stats' 
    AND column_name = 'vdp_call_minutes'
  ) THEN
    ALTER TABLE weekly_usage_stats 
    ADD COLUMN vdp_call_minutes INTEGER DEFAULT 0;
    
    COMMENT ON COLUMN weekly_usage_stats.vdp_call_minutes IS 
      'Time in minutes agent was actively on VDP calls (from agent_availability_tracking.total_calling_time)';
    
    RAISE NOTICE 'Added vdp_call_minutes column';
  ELSE
    RAISE NOTICE 'Column vdp_call_minutes already exists';
  END IF;

  -- Update vdp_total_minutes comment to clarify it's the sum
  COMMENT ON COLUMN weekly_usage_stats.vdp_total_minutes IS 
    'Total VDP time in minutes (vdp_available_minutes + vdp_call_minutes). Kept for backward compatibility.';
END $$;

-- Verify columns were added
SELECT 
  column_name, 
  data_type, 
  column_default,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'weekly_usage_stats' 
  AND column_name IN ('vdp_available_minutes', 'vdp_call_minutes', 'vdp_total_minutes')
ORDER BY column_name;
