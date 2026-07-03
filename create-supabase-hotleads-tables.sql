-- Create hotleads table in Supabase
CREATE TABLE IF NOT EXISTS hotleads (
  id SERIAL PRIMARY KEY,
  first_name TEXT,
  last_name TEXT,
  phone TEXT NOT NULL,
  email TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  address TEXT,
  call_date DATE NOT NULL,
  call_time TIME NOT NULL,
  duration_seconds INTEGER NOT NULL,
  hot_lead_reason TEXT NOT NULL,
  priority_score INTEGER DEFAULT 5,
  transferred BOOLEAN DEFAULT false,
  transfer_duration_ms INTEGER,
  transfer_status TEXT,
  taalk_call_id TEXT,
  taalk_market TEXT,
  taalk_lead_source TEXT,
  taalk_group_code TEXT,
  taalk_lead_id TEXT,
  persona TEXT,
  recording_url TEXT,
  assigned_to TEXT,
  follow_up_status TEXT,
  follow_up_date TIMESTAMP,
  follow_up_notes TEXT,
  conversion_result TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  cnresolution TEXT,
  taalk_state TEXT,
  taalk_city TEXT,
  taalk_email TEXT,
  taalk_address TEXT,
  taalk_beneficiary TEXT,
  taalk_relationship TEXT,
  taalk_reffered TEXT,
  taalk_sponsor_org TEXT,
  taalk_groupname TEXT,
  status TEXT DEFAULT 'NEW',
  last_contacted TIMESTAMP,
  cn_email TEXT
);

-- Create hot_lead_notifications table
CREATE TABLE IF NOT EXISTS hot_lead_notifications (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  agent_email TEXT NOT NULL,
  hot_lead_id INTEGER REFERENCES hotleads(id),
  lead_name TEXT NOT NULL,
  lead_phone TEXT NOT NULL,
  priority INTEGER DEFAULT 5,
  reason TEXT NOT NULL,
  assigned_at TIMESTAMP DEFAULT NOW(),
  notifications_sent TEXT[] DEFAULT '{}',
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create hot_lead_callbacks table
CREATE TABLE IF NOT EXISTS hot_lead_callbacks (
  id SERIAL PRIMARY KEY,
  phone_number TEXT NOT NULL,
  assigned_agent_email TEXT NOT NULL,
  hot_lead_id INTEGER REFERENCES hotleads(id),
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '24 hours'),
  is_active BOOLEAN DEFAULT true
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_hotleads_cn_email ON hotleads(cn_email);
CREATE INDEX IF NOT EXISTS idx_hotleads_status ON hotleads(status);
CREATE INDEX IF NOT EXISTS idx_hotleads_priority_score ON hotleads(priority_score);
CREATE INDEX IF NOT EXISTS idx_hotleads_call_date ON hotleads(call_date);
CREATE INDEX IF NOT EXISTS idx_hot_lead_notifications_agent_email ON hot_lead_notifications(agent_email);
CREATE INDEX IF NOT EXISTS idx_hot_lead_callbacks_agent_email ON hot_lead_callbacks(assigned_agent_email);
CREATE INDEX IF NOT EXISTS idx_hot_lead_callbacks_phone ON hot_lead_callbacks(phone_number);

-- Insert sample hotleads data if table is empty
INSERT INTO hotleads (
  first_name, last_name, phone, state, city, call_date, call_time, 
  duration_seconds, hot_lead_reason, priority_score, taalk_market, 
  taalk_groupname, status, cn_email
) 
SELECT 
  'Michael', 'Johnson', '5551234567', 'TX', 'Dallas', CURRENT_DATE, '10:30:00',
  45, 'Human Answered - No Transfer', 5, 'Veteran', 'Hot Lead', 'NEW', 'cnsysop@aoglobelife.com'
WHERE NOT EXISTS (SELECT 1 FROM hotleads WHERE phone = '5551234567');

INSERT INTO hotleads (
  first_name, last_name, phone, state, city, call_date, call_time, 
  duration_seconds, hot_lead_reason, priority_score, taalk_market, 
  taalk_groupname, status, cn_email
) 
SELECT 
  'Sarah', 'Williams', '5559876543', 'FL', 'Miami', CURRENT_DATE, '11:15:00',
  67, 'Human Answered - No Transfer', 5, 'Veteran', 'Hot Lead', 'NEW', 'cnsysop@aoglobelife.com'
WHERE NOT EXISTS (SELECT 1 FROM hotleads WHERE phone = '5559876543');

INSERT INTO hotleads (
  first_name, last_name, phone, state, city, call_date, call_time, 
  duration_seconds, hot_lead_reason, priority_score, taalk_market, 
  taalk_groupname, status, cn_email
) 
SELECT 
  'Robert', 'Davis', '5555555555', 'CA', 'Los Angeles', CURRENT_DATE, '14:20:00',
  23, 'Transfer Lost Quickly', 5, 'Veteran', 'Hot Lead', 'NEW', 'cnsysop@aoglobelife.com'
WHERE NOT EXISTS (SELECT 1 FROM hotleads WHERE phone = '5555555555');

INSERT INTO hotleads (
  first_name, last_name, phone, state, city, call_date, call_time, 
  duration_seconds, hot_lead_reason, priority_score, taalk_market, 
  taalk_groupname, status, cn_email
) 
SELECT 
  'Jennifer', 'Brown', '5552468013', 'NY', 'New York', CURRENT_DATE, '09:45:00',
  89, 'Transfer Lost Quickly', 5, 'Globe', 'Hot Lead', 'NEW', 'cnsysop@aoglobelife.com'
WHERE NOT EXISTS (SELECT 1 FROM hotleads WHERE phone = '5552468013');

INSERT INTO hotleads (
  first_name, last_name, phone, state, city, call_date, call_time, 
  duration_seconds, hot_lead_reason, priority_score, taalk_market, 
  taalk_groupname, status, cn_email
) 
SELECT 
  'David', 'Miller', '5557891234', 'OH', 'Columbus', CURRENT_DATE, '16:30:00',
  156, 'Human Answered - No Transfer', 5, 'Plus', 'Hot Lead', 'NEW', 'cnsysop@aoglobelife.com'
WHERE NOT EXISTS (SELECT 1 FROM hotleads WHERE phone = '5557891234');

-- Add RLS (Row Level Security) policies
ALTER TABLE hotleads ENABLE ROW LEVEL SECURITY;
ALTER TABLE hot_lead_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE hot_lead_callbacks ENABLE ROW LEVEL SECURITY;

-- Create policies for hotleads
CREATE POLICY "Enable read access for all users" ON hotleads FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON hotleads FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON hotleads FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON hotleads FOR DELETE USING (true);

-- Create policies for hot_lead_notifications
CREATE POLICY "Enable read access for all users" ON hot_lead_notifications FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON hot_lead_notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON hot_lead_notifications FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON hot_lead_notifications FOR DELETE USING (true);

-- Create policies for hot_lead_callbacks
CREATE POLICY "Enable read access for all users" ON hot_lead_callbacks FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON hot_lead_callbacks FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON hot_lead_callbacks FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON hot_lead_callbacks FOR DELETE USING (true);

-- Create functions for auto-updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for auto-updating timestamps
CREATE TRIGGER update_hotleads_updated_at 
  BEFORE UPDATE ON hotleads 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();