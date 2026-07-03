-- REMOVE ALL live_call_boardt REFERENCES FROM TRIGGER
-- This trigger should NOT try to update live_call_boardt - it doesn't exist and we don't need it

-- Drop the existing trigger function completely
DROP FUNCTION IF EXISTS trigger_update_live_call_boardt_on_metric() CASCADE;

-- Create a NEW trigger function that does NOTHING (just allows inserts to succeed)
CREATE OR REPLACE FUNCTION trigger_update_live_call_boardt_on_metric()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- DO NOTHING - just allow the insert to succeed
  -- We don't need to update live_call_boardt - stats are calculated in real-time from agent_dial_metrics
  RETURN NEW;
END;
$$;

-- Recreate the triggers (they'll do nothing but won't error)
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

COMMENT ON FUNCTION trigger_update_live_call_boardt_on_metric() IS 'Trigger function that does nothing - allows agent_dial_metrics inserts to succeed. Stats are calculated in real-time from agent_dial_metrics, no live_call_boardt needed.';
