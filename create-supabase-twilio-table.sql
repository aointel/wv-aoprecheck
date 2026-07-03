-- CREATE TWILIO CALL LOGS TABLE IN SUPABASE
-- Copy and paste this entire SQL into your Supabase SQL Editor and run it

-- Create twilio_call_logs table
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
  owner_email VARCHAR(255) NOT NULL,
  agent_identity VARCHAR(255),
  
  -- Call metadata
  call_started_at TIMESTAMPTZ,
  call_ended_at TIMESTAMPTZ,
  answered_by VARCHAR(255),
  
  -- Tracking data
  call_source VARCHAR(50) DEFAULT 'unknown',
  metadata JSONB DEFAULT '{}',
  
  -- System timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_twilio_call_logs_owner_email ON twilio_call_logs(owner_email);
CREATE INDEX IF NOT EXISTS idx_twilio_call_logs_call_started_at ON twilio_call_logs(call_started_at);
CREATE INDEX IF NOT EXISTS idx_twilio_call_logs_twilio_sid ON twilio_call_logs(twilio_call_sid);
CREATE INDEX IF NOT EXISTS idx_twilio_call_logs_call_direction ON twilio_call_logs(call_direction);

-- Insert a test record to verify table works
INSERT INTO twilio_call_logs (
  twilio_call_sid,
  call_direction,
  from_number,
  to_number,
  call_status,
  owner_email,
  call_source,
  call_started_at
) VALUES (
  'TEST-CALL-SID-123',
  'outbound',
  '+16052500834',
  '+15551234567',
  'completed',
  'davidfulfer@aoglobelife.com',
  'test_creation',
  NOW()
) ON CONFLICT (twilio_call_sid) DO NOTHING;

-- Verify the table was created
SELECT COUNT(*) as total_records FROM twilio_call_logs;
SELECT * FROM twilio_call_logs WHERE call_source = 'test_creation' LIMIT 1;