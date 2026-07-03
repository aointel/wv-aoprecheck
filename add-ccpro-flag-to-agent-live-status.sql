-- Add CCPRO flag column to agent_live_call_status table
-- This flags whether the agent has Call Connector Pro PROFESSIONAL access

ALTER TABLE agent_live_call_status
ADD COLUMN IF NOT EXISTS ccpro_enabled BOOLEAN DEFAULT false;

-- Add comment
COMMENT ON COLUMN agent_live_call_status.ccpro_enabled IS 'Flag indicating if agent has CCPRO (Call Connector Pro PROFESSIONAL) access enabled';

-- Create index for querying CCPRO agents
CREATE INDEX IF NOT EXISTS idx_agent_live_call_status_ccpro 
  ON agent_live_call_status (ccpro_enabled, status)
  WHERE ccpro_enabled = true;

