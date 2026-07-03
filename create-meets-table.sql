-- Create meets table for AO Meet (appointments/scheduled presentations)
CREATE TABLE IF NOT EXISTS meets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Agent/Producer info
  agent_email TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  
  -- Client/Lead info
  client_first_name TEXT,
  client_last_name TEXT,
  client_phone TEXT NOT NULL,
  client_email TEXT,
  client_city TEXT,
  client_state TEXT,
  client_zip TEXT,
  
  -- Meet details
  scheduled_date TIMESTAMPTZ NOT NULL,
  scheduled_time TEXT NOT NULL, -- "10:00 AM", "2:30 PM"
  duration_minutes INTEGER DEFAULT 60,
  market_type TEXT, -- "Veteran", "Senior", "Family"
  meet_type TEXT DEFAULT 'presentation', -- 'presentation', 'callback', 'follow_up'
  
  -- Status tracking
  status TEXT DEFAULT 'scheduled', -- 'scheduled', 'in_progress', 'completed', 'no_show', 'cancelled'
  
  -- Notes and follow-up
  notes TEXT,
  internal_notes TEXT, -- Agent's private notes
  
  -- Link to presentation session (when they actually present)
  presentation_session_id UUID REFERENCES presentation_sessions(id),
  
  -- Callback/Follow-up tracking
  is_callback BOOLEAN DEFAULT false,
  parent_meet_id UUID REFERENCES meets(id), -- If this is a callback from another meet
  callback_reason TEXT, -- "THINK", "Need spouse", "Review finances", etc.
  
  -- Outcome (after presentation)
  disposition TEXT, -- "SOLD", "NOT_INTERESTED", "THINK", "CANT_AFFORD", "NO_SHOW"
  sale_amount DECIMAL(10,2),
  products_sold TEXT[], -- Array of product names
  
  -- Attachments and comments
  attachments JSONB DEFAULT '[]',
  comments_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  
  -- Source tracking
  created_from TEXT DEFAULT 'manual', -- 'manual', 'call_connector', 'auto_callback', 'lead_card'
  
  -- Reminders
  reminder_sent BOOLEAN DEFAULT false,
  reminder_sent_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_meets_agent_email ON meets(agent_email);
CREATE INDEX IF NOT EXISTS idx_meets_scheduled_date ON meets(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_meets_status ON meets(status);
CREATE INDEX IF NOT EXISTS idx_meets_presentation_session ON meets(presentation_session_id);
CREATE INDEX IF NOT EXISTS idx_meets_parent ON meets(parent_meet_id);
CREATE INDEX IF NOT EXISTS idx_meets_created_at ON meets(created_at);

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_meets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_meets_timestamp ON meets;
CREATE TRIGGER update_meets_timestamp
  BEFORE UPDATE ON meets
  FOR EACH ROW
  EXECUTE FUNCTION update_meets_updated_at();

-- Comments for documentation
COMMENT ON TABLE meets IS 'AO Meet - Scheduled appointments and presentations';
COMMENT ON COLUMN meets.meet_type IS 'Type: presentation (initial), callback (from THINK), follow_up';
COMMENT ON COLUMN meets.presentation_session_id IS 'Links to actual presentation when agent starts HPPRO';
COMMENT ON COLUMN meets.is_callback IS 'True if this meet was created from a THINK disposition';
COMMENT ON COLUMN meets.parent_meet_id IS 'References the original meet if this is a callback';

