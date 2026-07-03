-- Create comprehensive Twilio call logging table in Supabase
-- This will capture EVERY outbound Twilio call with full attribution

CREATE TABLE IF NOT EXISTS twilio_call_logs (
  id SERIAL PRIMARY KEY,
  
  -- Twilio call data
  twilio_call_sid VARCHAR(34) UNIQUE NOT NULL,
  call_direction VARCHAR(20) NOT NULL,
  from_number VARCHAR(20) NOT NULL,
  to_number VARCHAR(20) NOT NULL,
  call_status VARCHAR(20) NOT NULL,
  call_duration INTEGER DEFAULT 0,
  
  -- Agent attribution (THE KEY PART)
  owner_email VARCHAR(255) NOT NULL, -- The logged-in user who initiated the call
  agent_identity VARCHAR(255), -- WebRTC identity if available
  
  -- Call metadata
  call_started_at TIMESTAMPTZ,
  call_ended_at TIMESTAMPTZ,
  answered_by VARCHAR(255),
  
  -- Tracking data
  call_source VARCHAR(50) DEFAULT 'unknown', -- call_connector_pro, twilio_service, etc.
  metadata JSONB DEFAULT '{}', -- Store full Twilio metadata
  
  -- System timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_twilio_call_logs_owner_email ON twilio_call_logs(owner_email);
CREATE INDEX IF NOT EXISTS idx_twilio_call_logs_call_started_at ON twilio_call_logs(call_started_at);
CREATE INDEX IF NOT EXISTS idx_twilio_call_logs_twilio_sid ON twilio_call_logs(twilio_call_sid);
CREATE INDEX IF NOT EXISTS idx_twilio_call_logs_call_direction ON twilio_call_logs(call_direction);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_twilio_call_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_twilio_call_logs_updated_at ON twilio_call_logs;
CREATE TRIGGER trigger_update_twilio_call_logs_updated_at
  BEFORE UPDATE ON twilio_call_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_twilio_call_logs_updated_at();