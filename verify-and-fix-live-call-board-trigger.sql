-- ============================================================================
-- VERIFY AND FIX LIVE_CALL_BOARD TRIGGER
-- 
-- This script checks if the trigger exists and is working correctly,
-- and recreates it if necessary.
-- ============================================================================

-- Step 1: Check if trigger exists
DO $$
DECLARE
  trigger_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 
    FROM pg_trigger 
    WHERE tgname = 'trigger_update_live_call_board_on_metric_insert'
  ) INTO trigger_exists;
  
  IF trigger_exists THEN
    RAISE NOTICE '✅ Trigger exists: trigger_update_live_call_board_on_metric_insert';
  ELSE
    RAISE NOTICE '❌ Trigger MISSING: trigger_update_live_call_board_on_metric_insert';
  END IF;
END $$;

-- Step 2: Check if trigger function exists
DO $$
DECLARE
  function_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 
    FROM pg_proc 
    WHERE proname = 'trigger_update_live_call_board_on_metric'
  ) INTO function_exists;
  
  IF function_exists THEN
    RAISE NOTICE '✅ Function exists: trigger_update_live_call_board_on_metric';
  ELSE
    RAISE NOTICE '❌ Function MISSING: trigger_update_live_call_board_on_metric';
  END IF;
END $$;

-- Step 3: Check if update function exists
DO $$
DECLARE
  function_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 
    FROM pg_proc 
    WHERE proname = 'update_live_call_board_stats_for_agent'
  ) INTO function_exists;
  
  IF function_exists THEN
    RAISE NOTICE '✅ Function exists: update_live_call_board_stats_for_agent';
  ELSE
    RAISE NOTICE '❌ Function MISSING: update_live_call_board_stats_for_agent';
  END IF;
END $$;

-- Step 4: Recreate trigger function (safe to run multiple times)
CREATE OR REPLACE FUNCTION trigger_update_live_call_board_on_metric()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update stats for this agent when a new metric is inserted
  IF NEW.agent_email IS NOT NULL AND NEW.agent_email != '' THEN
    PERFORM update_live_call_board_stats_for_agent(NEW.agent_email);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Step 5: Drop and recreate trigger (safe to run multiple times)
DROP TRIGGER IF EXISTS trigger_update_live_call_board_on_metric_insert ON agent_dial_metrics;
CREATE TRIGGER trigger_update_live_call_board_on_metric_insert
  AFTER INSERT ON agent_dial_metrics
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_live_call_board_on_metric();

-- Step 6: Drop and recreate UPDATE trigger (safe to run multiple times)
DROP TRIGGER IF EXISTS trigger_update_live_call_board_on_metric_update ON agent_dial_metrics;
CREATE TRIGGER trigger_update_live_call_board_on_metric_update
  AFTER UPDATE ON agent_dial_metrics
  FOR EACH ROW
  WHEN (OLD.event_type IS DISTINCT FROM NEW.event_type 
        OR OLD.event_timestamp IS DISTINCT FROM NEW.event_timestamp
        OR OLD.agent_email IS DISTINCT FROM NEW.agent_email
        OR OLD.lead_phone IS DISTINCT FROM NEW.lead_phone)
  EXECUTE FUNCTION trigger_update_live_call_board_on_metric();

-- Step 7: Verify trigger is enabled
DO $$
DECLARE
  trigger_enabled boolean;
BEGIN
  SELECT tgenabled = 'O' 
  FROM pg_trigger 
  WHERE tgname = 'trigger_update_live_call_board_on_metric_insert'
  INTO trigger_enabled;
  
  IF trigger_enabled THEN
    RAISE NOTICE '✅ Trigger is ENABLED';
  ELSE
    RAISE NOTICE '❌ Trigger is DISABLED - attempting to enable...';
    -- Note: Cannot enable trigger directly in DO block, need to use ALTER TABLE
  END IF;
END $$;

-- Step 8: Enable trigger (in case it was disabled)
ALTER TABLE agent_dial_metrics ENABLE TRIGGER trigger_update_live_call_board_on_metric_insert;
ALTER TABLE agent_dial_metrics ENABLE TRIGGER trigger_update_live_call_board_on_metric_update;

-- Step 9: Final confirmation
DO $$
BEGIN
  RAISE NOTICE '✅ Trigger setup complete!';
  RAISE NOTICE '   The trigger will now automatically update live_call_board when agent_dial_metrics is inserted/updated.';
END $$;

