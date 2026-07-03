-- Create trigger to automatically sync trialone based on ccpro_enabled
-- Whenever ccpro_enabled changes, update trialone accordingly

CREATE OR REPLACE FUNCTION sync_trialone_from_ccpro()
RETURNS TRIGGER AS $$
BEGIN
  -- If ccpro_enabled is false, set trialone to true (trial user)
  -- If ccpro_enabled is true, set trialone to false (pro user)
  NEW.trialone = CASE 
    WHEN NEW.ccpro_enabled = false THEN true
    WHEN NEW.ccpro_enabled = true THEN false
    ELSE false  -- Default to false if null
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger that fires BEFORE INSERT OR UPDATE
DROP TRIGGER IF EXISTS trigger_sync_trialone_from_ccpro ON agent_live_call_status;
CREATE TRIGGER trigger_sync_trialone_from_ccpro
  BEFORE INSERT OR UPDATE OF ccpro_enabled ON agent_live_call_status
  FOR EACH ROW
  EXECUTE FUNCTION sync_trialone_from_ccpro();

-- Comment
COMMENT ON FUNCTION sync_trialone_from_ccpro() IS 'Automatically sets trialone=true when ccpro_enabled=false, and trialone=false when ccpro_enabled=true';

