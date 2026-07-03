
-- Create table for AO Precheck verification sessions
CREATE TABLE IF NOT EXISTS aoi_precheck_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_name TEXT NOT NULL,
  client_email TEXT,
  client_phone TEXT,
  agent_email TEXT NOT NULL,
  agent_name TEXT,
  verification_method TEXT CHECK (verification_method IN ('zoom', 'phone', 'conference')) NOT NULL,
  status TEXT CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  session_data JSONB,
  verification_notes TEXT,
  policy_number TEXT,
  beneficiary_info TEXT,
  premium_amount DECIMAL(10,2),
  verification_score INTEGER CHECK (verification_score >= 0 AND verification_score <= 100),
  screenshots_count INTEGER DEFAULT 0,
  call_duration INTEGER, -- in seconds
  cancellation_reason TEXT,
  
  -- Indexes for better query performance
  INDEX idx_aoi_precheck_agent_email (agent_email),
  INDEX idx_aoi_precheck_status (status),
  INDEX idx_aoi_precheck_created_at (created_at),
  INDEX idx_aoi_precheck_method (verification_method)
);

-- Add RLS (Row Level Security) policies
ALTER TABLE aoi_precheck_sessions ENABLE ROW LEVEL SECURITY;

-- Policy to allow agents to see their own sessions
CREATE POLICY "Agents can view their own sessions" ON aoi_precheck_sessions
  FOR SELECT USING (agent_email = auth.jwt() ->> 'email');

-- Policy to allow agents to update their own sessions
CREATE POLICY "Agents can update their own sessions" ON aoi_precheck_sessions
  FOR UPDATE USING (agent_email = auth.jwt() ->> 'email');

-- Policy to allow agents to insert new sessions
CREATE POLICY "Agents can insert new sessions" ON aoi_precheck_sessions
  FOR INSERT WITH CHECK (agent_email = auth.jwt() ->> 'email');

-- Policy for admin access (adjust based on your admin identification method)
CREATE POLICY "Admins can manage all sessions" ON aoi_precheck_sessions
  FOR ALL USING (
    auth.jwt() ->> 'email' IN (
      'cnsysop@aoglobelife.com',
      'admin@aoglobelife.com'
    )
  );

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_aoi_precheck_sessions_updated_at 
  BEFORE UPDATE ON aoi_precheck_sessions 
  FOR EACH ROW 
  EXECUTE PROCEDURE update_updated_at_column();
