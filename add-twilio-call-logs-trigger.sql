-- Add trigger on twilio_call_logs to update live_call_boardt when new calls are logged
-- This ensures dials are updated in real-time when calls are made
-- CRITICAL: This trigger calls update_live_call_boardt_stats_for_agent() which recalculates
-- all stats (dialed, reached, booked) from source tables for the agent

-- Trigger function to update stats when new call is logged
CREATE OR REPLACE FUNCTION trigger_update_live_call_boardt_on_call()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update stats for this agent when a new call is logged
  -- Only update if owner_email is set (outbound calls have owner_email)
  IF NEW.owner_email IS NOT NULL AND NEW.owner_email != '' AND NEW.call_direction = 'outbound' THEN
    PERFORM update_live_call_boardt_stats_for_agent(NEW.owner_email);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop old trigger if it exists
DROP TRIGGER IF EXISTS trigger_update_live_call_boardt_on_call_insert ON twilio_call_logs;
DROP TRIGGER IF EXISTS trigger_update_live_call_boardt_on_call_update ON twilio_call_logs;

-- Create INSERT trigger (fires when new call is logged)
CREATE TRIGGER trigger_update_live_call_boardt_on_call_insert
  AFTER INSERT ON twilio_call_logs
  FOR EACH ROW
  WHEN (NEW.owner_email IS NOT NULL AND NEW.owner_email != '' AND NEW.call_direction = 'outbound')
  EXECUTE FUNCTION trigger_update_live_call_boardt_on_call();

-- Create UPDATE trigger (fires when call status/duration changes - e.g., when call completes)
-- CRITICAL: When call_status changes from NULL to 'answered'/'completed', we need to recalculate reached count
CREATE TRIGGER trigger_update_live_call_boardt_on_call_update
  AFTER UPDATE OF call_status, call_duration, owner_email, call_direction ON twilio_call_logs
  FOR EACH ROW
  WHEN (
    (OLD.call_status IS DISTINCT FROM NEW.call_status)
    OR (OLD.call_duration IS DISTINCT FROM NEW.call_duration)
    OR (OLD.owner_email IS DISTINCT FROM NEW.owner_email)
    OR (OLD.call_direction IS DISTINCT FROM NEW.call_direction)
  )
  AND (NEW.owner_email IS NOT NULL AND NEW.owner_email != '' AND NEW.call_direction = 'outbound')
  EXECUTE FUNCTION trigger_update_live_call_boardt_on_call();

-- Comment on function
COMMENT ON FUNCTION trigger_update_live_call_boardt_on_call() IS 'Trigger function that updates live_call_boardt stats when twilio_call_logs is inserted/updated. Ensures dials are updated in real-time.';
