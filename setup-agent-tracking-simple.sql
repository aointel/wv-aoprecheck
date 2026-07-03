-- Simple Agent Availability Tracking Setup
-- Run this in Supabase SQL Editor

-- Create the main table
CREATE TABLE IF NOT EXISTS agent_availability_tracking (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id VARCHAR(50) NOT NULL,
  agent_email VARCHAR(255) NOT NULL,
  agent_name VARCHAR(255),
  tracking_date DATE NOT NULL,
  current_status VARCHAR(20) NOT NULL CHECK (current_status IN ('online', 'calling', 'offline')),
  status_changed_at TIMESTAMP WITH TIME ZONE NOT NULL,
  previous_status VARCHAR(20),
  total_available_time INTEGER DEFAULT 0,
  total_calling_time INTEGER DEFAULT 0,
  total_offline_time INTEGER DEFAULT 0,
  current_session_start TIMESTAMP WITH TIME ZONE,
  last_activity TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_agent_availability_agent_id ON agent_availability_tracking(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_availability_date ON agent_availability_tracking(tracking_date);
CREATE INDEX IF NOT EXISTS idx_agent_availability_status ON agent_availability_tracking(current_status);
CREATE INDEX IF NOT EXISTS idx_agent_availability_agent_date ON agent_availability_tracking(agent_id, tracking_date);

-- Unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_availability_unique 
ON agent_availability_tracking(agent_id, tracking_date);

-- Update trigger
CREATE OR REPLACE FUNCTION update_agent_availability_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_agent_availability_updated_at
  BEFORE UPDATE ON agent_availability_tracking
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_availability_updated_at();


