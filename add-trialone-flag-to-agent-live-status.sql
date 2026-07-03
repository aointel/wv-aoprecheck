-- Add trialone flag to agent_live_call_status table
-- trialone = true: User is on pre-trial (50 leads max, one-time use)
-- trialone = false: User has pro access (unlimited leads)

ALTER TABLE agent_live_call_status
ADD COLUMN IF NOT EXISTS trialone BOOLEAN DEFAULT false;

-- Add comment
COMMENT ON COLUMN agent_live_call_status.trialone IS 'Pre-trial flag: true = one-time 50 leads trial, false = pro access';

-- Create index for querying trial users
CREATE INDEX IF NOT EXISTS idx_agent_live_call_status_trialone 
  ON agent_live_call_status (trialone)
  WHERE trialone = true;

