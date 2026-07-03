-- Create AgentHierarchy table for tracking team structure
-- This maps each agent to their MGA and RGA by associate IDs

CREATE TABLE IF NOT EXISTS public.agent_hierarchy (
  id SERIAL PRIMARY KEY,
  agent_associate_id INTEGER NOT NULL UNIQUE,
  agent_name TEXT NOT NULL,
  agent_email TEXT,
  
  mga_associate_id INTEGER,
  mga_name TEXT,
  
  rga_associate_id INTEGER,
  rga_name TEXT,
  
  aoi_market TEXT,
  ao_market_2 TEXT,
  designated_market TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Add indexes for fast lookups
  CONSTRAINT unique_agent_associate_id UNIQUE (agent_associate_id)
);

-- Create indexes for fast team queries
CREATE INDEX IF NOT EXISTS idx_agent_hierarchy_mga ON agent_hierarchy(mga_associate_id);
CREATE INDEX IF NOT EXISTS idx_agent_hierarchy_rga ON agent_hierarchy(rga_associate_id);
CREATE INDEX IF NOT EXISTS idx_agent_hierarchy_agent_email ON agent_hierarchy(agent_email);

-- Create a trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_agent_hierarchy_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER agent_hierarchy_updated_at
  BEFORE UPDATE ON agent_hierarchy
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_hierarchy_updated_at();

-- Add comment to table
COMMENT ON TABLE agent_hierarchy IS 'Hierarchical team structure mapping agents to their MGAs and RGAs by associate ID';

