-- ============================================================================
-- ADD AGENT USAGE TRACKING TO LIVE CALL BOARD
-- 
-- This adds columns to track how long agents spend in "available" or "on a call"
-- ============================================================================

-- Add usage tracking columns to live_call_boardt
ALTER TABLE live_call_boardt 
ADD COLUMN IF NOT EXISTS total_available_seconds INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_on_call_seconds INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_status_change_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS current_status_started_at TIMESTAMP WITH TIME ZONE;

-- Add index for status queries
CREATE INDEX IF NOT EXISTS idx_live_call_boardt_status ON live_call_boardt(current_status_started_at) 
WHERE current_status_started_at IS NOT NULL;

-- Function to update agent status and track time in live_call_boardt
-- Unified status system: 'active' (online/available), 'idle' (logged in but inactive), 'connected' (on a call)
CREATE OR REPLACE FUNCTION update_agent_usage_status(
  p_agent_email TEXT,
  p_new_status TEXT -- 'active', 'idle', 'connected'
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_status TEXT;
  v_last_status_change TIMESTAMP WITH TIME ZONE;
  v_time_diff INTEGER;
  v_now TIMESTAMP WITH TIME ZONE := NOW();
BEGIN
  -- Get current status and last change time from live_call_boardt
  SELECT 
    COALESCE(status, 'idle'),
    COALESCE(last_status_change_at, COALESCE(created_at, v_now))
  INTO v_current_status, v_last_status_change
  FROM live_call_boardt
  WHERE agent_email = p_agent_email;
  
  -- If agent doesn't exist, create record
  IF NOT FOUND THEN
    INSERT INTO live_call_boardt (
      agent_email,
      status,
      last_status_change_at,
      current_status_started_at,
      today_dialed,
      today_reached,
      today_booked,
      today_instant_presentation
    ) VALUES (
      p_agent_email,
      p_new_status,
      v_now,
      v_now,
      0, 0, 0, 0
    );
    RETURN;
  END IF;
  
  -- Calculate time difference since last status change (only if status actually changed)
  IF v_current_status != p_new_status THEN
    v_time_diff := EXTRACT(EPOCH FROM (v_now - v_last_status_change))::INTEGER;
    
    -- Add time to appropriate category based on previous status
    UPDATE live_call_boardt
    SET 
      status = p_new_status,
      last_status_change_at = v_now,
      current_status_started_at = v_now,
      total_available_seconds = CASE 
        WHEN v_current_status = 'active' THEN COALESCE(total_available_seconds, 0) + v_time_diff
        ELSE COALESCE(total_available_seconds, 0)
      END,
      total_on_call_seconds = CASE 
        WHEN v_current_status = 'connected' THEN COALESCE(total_on_call_seconds, 0) + v_time_diff
        ELSE COALESCE(total_on_call_seconds, 0)
      END,
      updated_at = v_now
    WHERE agent_email = p_agent_email;
    
    RAISE NOTICE 'Updated agent %: % -> % (added % seconds to previous status)', 
      p_agent_email, v_current_status, p_new_status, v_time_diff;
  END IF;
END;
$$;

-- Function to get daily usage summary
CREATE OR REPLACE FUNCTION get_agent_usage_summary(
  p_agent_email TEXT DEFAULT NULL,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  agent_email TEXT,
  total_available_hours NUMERIC,
  total_on_call_hours NUMERIC,
  total_available_formatted TEXT,
  total_on_call_formatted TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    lcb.agent_email,
    ROUND(lcb.total_available_seconds::NUMERIC / 3600, 2) as total_available_hours,
    ROUND(lcb.total_on_call_seconds::NUMERIC / 3600, 2) as total_on_call_hours,
    TO_CHAR(INTERVAL '1 second' * lcb.total_available_seconds, 'HH24:MI:SS') as total_available_formatted,
    TO_CHAR(INTERVAL '1 second' * lcb.total_on_call_seconds, 'HH24:MI:SS') as total_on_call_formatted
  FROM live_call_boardt lcb
  WHERE (p_agent_email IS NULL OR lcb.agent_email = p_agent_email)
    AND lcb.agent_email IS NOT NULL
  ORDER BY lcb.total_available_seconds DESC;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
-- GRANT EXECUTE ON FUNCTION update_agent_usage_status TO authenticated;
-- GRANT EXECUTE ON FUNCTION get_agent_usage_summary TO authenticated;

COMMENT ON COLUMN live_call_boardt.total_available_seconds IS 'Total seconds agent spent in "active" (online/available) status today';
COMMENT ON COLUMN live_call_boardt.total_on_call_seconds IS 'Total seconds agent spent in "connected" (on a call) status today';
COMMENT ON COLUMN live_call_boardt.last_status_change_at IS 'Timestamp of last status change';
COMMENT ON COLUMN live_call_boardt.current_status_started_at IS 'Timestamp when current status started';

SELECT '✅ Agent usage tracking columns and functions added!' AS status;
