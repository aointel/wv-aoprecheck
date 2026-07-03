-- Create war_connects table if it doesn't exist
-- This table tracks connects for the Weekly Agency Report (WAR) system

CREATE TABLE IF NOT EXISTS war_connects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connect_id TEXT NOT NULL UNIQUE,
  agent_email TEXT NOT NULL,
  lead_name TEXT NOT NULL,
  lead_phone TEXT NOT NULL,
  connect_date TIMESTAMP NOT NULL,
  connect_time TEXT NOT NULL,
  duration INTEGER NOT NULL,
  lead_source TEXT,
  market TEXT NOT NULL,
  state TEXT NOT NULL,
  connect_type TEXT NOT NULL,
  production_status TEXT DEFAULT 'pending',
  immediate_outcome TEXT,
  disposition TEXT,
  appointment_set BOOLEAN DEFAULT false,
  appointment_date TIMESTAMP,
  sale_amount DECIMAL(10,2),
  follow_up_required BOOLEAN DEFAULT false,
  next_contact_date TIMESTAMP,
  priority_level TEXT DEFAULT 'normal',
  tags JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  reported_at TIMESTAMP,
  review_status TEXT,
  reviewed_at TIMESTAMP,
  next_review_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_war_connects_agent_email ON war_connects(agent_email);
CREATE INDEX IF NOT EXISTS idx_war_connects_connect_date ON war_connects(connect_date);
CREATE INDEX IF NOT EXISTS idx_war_connects_review_status ON war_connects(review_status);
CREATE INDEX IF NOT EXISTS idx_war_connects_connect_id ON war_connects(connect_id);

-- Add comments
COMMENT ON TABLE war_connects IS 'Tracks connects for Weekly Agency Report (WAR) - includes AO Intelligence calls, appointments, and Call Connector Pro connects';
COMMENT ON COLUMN war_connects.review_status IS 'pending | reviewed - tracks if connect has been reviewed in card deck';
COMMENT ON COLUMN war_connects.disposition IS 'Final outcome: Sale, Appointment, Not interested, etc.';
