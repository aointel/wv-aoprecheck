-- FIX: Make trigger handle missing live_call_boardt table gracefully
-- This allows agent_dial_metrics inserts to succeed even if live_call_boardt doesn't exist

-- Drop the existing trigger function
DROP FUNCTION IF EXISTS trigger_update_live_call_boardt_on_metric() CASCADE;

-- Create a new trigger function that handles missing table gracefully
CREATE OR REPLACE FUNCTION trigger_update_live_call_boardt_on_metric()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if live_call_boardt table exists before trying to update it
  -- If table doesn't exist, just return NEW (allow the insert to succeed)
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'live_call_boardt'
  ) THEN
    -- Table doesn't exist - just allow the insert to proceed
    RETURN NEW;
  END IF;
  
  -- Table exists - try to update it
  BEGIN
    PERFORM update_live_call_boardt_stats_for_agent(NEW.agent_email);
  EXCEPTION WHEN OTHERS THEN
    -- If update fails for any reason, log error but don't block the insert
    RAISE WARNING 'Failed to update live_call_boardt for agent %: %', NEW.agent_email, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$;

-- Recreate the triggers
DROP TRIGGER IF EXISTS trigger_update_live_call_boardt_on_metric_insert ON agent_dial_metrics;
CREATE TRIGGER trigger_update_live_call_boardt_on_metric_insert
  AFTER INSERT ON agent_dial_metrics
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_live_call_boardt_on_metric();

DROP TRIGGER IF EXISTS trigger_update_live_call_boardt_on_metric_update ON agent_dial_metrics;
CREATE TRIGGER trigger_update_live_call_boardt_on_metric_update
  AFTER UPDATE ON agent_dial_metrics
  FOR EACH ROW
  WHEN (OLD.event_type IS DISTINCT FROM NEW.event_type OR 
        OLD.call_status IS DISTINCT FROM NEW.call_status OR 
        OLD.disposition IS DISTINCT FROM NEW.disposition)
  EXECUTE FUNCTION trigger_update_live_call_boardt_on_metric();

COMMENT ON FUNCTION trigger_update_live_call_boardt_on_metric() IS 'Trigger function that updates live_call_boardt stats when agent_dial_metrics is inserted/updated. Handles missing table gracefully - allows inserts to succeed even if live_call_boardt does not exist.';
