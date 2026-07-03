-- MINIMAL SUPABASE MIGRATION - Start with essential tables only
-- This creates the core tables needed for ConnectNow without conflicts

-- =====================================================
-- 1. CORE TABLES FIRST
-- =====================================================

-- Masterlead table (main leads table for Supabase)
CREATE TABLE IF NOT EXISTS masterlead (
  id SERIAL PRIMARY KEY,
  first_name TEXT,
  last_name TEXT,
  phone TEXT NOT NULL,
  email TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  address TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  called_at TIMESTAMP,
  dnc BOOLEAN DEFAULT false,
  try_count INTEGER DEFAULT 0,
  answered BOOLEAN DEFAULT false,
  has_sent_sms BOOLEAN DEFAULT false,
  has_open_link BOOLEAN DEFAULT false,
  has_redirect_call BOOLEAN DEFAULT false,
  duration INTEGER,
  duration_after_transfer INTEGER,
  has_summary BOOLEAN DEFAULT false,
  call_disposition TEXT,
  disposition_notes TEXT,
  disposition_timestamp TIMESTAMP,
  taalk_sponsor_org TEXT,
  taalk_market TEXT,
  taalk_lead_source TEXT,
  taalk_state TEXT,
  taalk_referred TEXT,
  taalk_relationship TEXT,
  taalk_secret_key TEXT,
  taalk_group_code TEXT,
  taalk_lead_id TEXT,
  taalk_city TEXT,
  taalk_email TEXT,
  taalk_zip TEXT,
  taalk_address TEXT,
  taalk_beneficiary TEXT,
  taalk_groupname TEXT,
  immediate_outcome TEXT,
  cnresolution TEXT,
  status TEXT DEFAULT 'NEW',
  last_contacted TIMESTAMP,
  cn_email TEXT
);

-- Hotleads table (matching existing structure exactly)
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

-- Appointments table
CREATE TABLE IF NOT EXISTS appointments (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  appointment_type TEXT NOT NULL DEFAULT 'consultation',
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  duration INTEGER NOT NULL DEFAULT 60,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  agent_id TEXT NOT NULL,
  agent_email TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  lead_id TEXT,
  lead_name TEXT NOT NULL,
  lead_phone TEXT NOT NULL,
  lead_email TEXT,
  meeting_platform TEXT NOT NULL DEFAULT 'zoom',
  zoom_meeting_id TEXT,
  zoom_password TEXT,
  zoom_join_url TEXT,
  twilio_room_name TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled',
  confirmation_status TEXT DEFAULT 'pending',
  reminders_sent INTEGER DEFAULT 0,
  notes TEXT,
  internal_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  cancelled_at TIMESTAMP,
  completed_at TIMESTAMP
);

-- WAR connects table
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

-- Call logs table
CREATE TABLE IF NOT EXISTS call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_sid TEXT NOT NULL,
  agent_email TEXT NOT NULL,
  lead_phone TEXT NOT NULL,
  lead_name TEXT,
  call_status TEXT,
  call_direction TEXT DEFAULT 'outbound',
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  duration INTEGER DEFAULT 0,
  recording_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- 2. ENABLE RLS AND CREATE POLICIES
-- =====================================================

ALTER TABLE masterlead ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotleads ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE war_connects ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;

-- Create permissive policies
CREATE POLICY "Enable all access" ON masterlead FOR ALL USING (true);
CREATE POLICY "Enable all access" ON hotleads FOR ALL USING (true);
CREATE POLICY "Enable all access" ON appointments FOR ALL USING (true);
CREATE POLICY "Enable all access" ON war_connects FOR ALL USING (true);
CREATE POLICY "Enable all access" ON call_logs FOR ALL USING (true);

-- =====================================================
-- 3. CREATE INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_masterlead_cn_email ON masterlead(cn_email);
CREATE INDEX IF NOT EXISTS idx_masterlead_status ON masterlead(status);
CREATE INDEX IF NOT EXISTS idx_masterlead_phone ON masterlead(phone);

CREATE INDEX IF NOT EXISTS idx_hotleads_cn_email ON hotleads(cn_email);
CREATE INDEX IF NOT EXISTS idx_hotleads_status ON hotleads(status);
CREATE INDEX IF NOT EXISTS idx_hotleads_phone ON hotleads(phone);

CREATE INDEX IF NOT EXISTS idx_appointments_agent_email ON appointments(agent_email);
CREATE INDEX IF NOT EXISTS idx_appointments_start_time ON appointments(start_time);

CREATE INDEX IF NOT EXISTS idx_war_connects_agent_email ON war_connects(agent_email);
CREATE INDEX IF NOT EXISTS idx_war_connects_connect_date ON war_connects(connect_date);

-- =====================================================
-- 4. INSERT SAMPLE DATA
-- =====================================================

-- Add unique constraints for conflict handling
ALTER TABLE masterlead ADD CONSTRAINT masterlead_phone_unique UNIQUE (phone);
ALTER TABLE hotleads ADD CONSTRAINT hotleads_phone_unique UNIQUE (phone);

-- Insert sample masterlead data
INSERT INTO masterlead (
  first_name, last_name, phone, state, city, taalk_market, 
  taalk_groupname, status, cn_email
) VALUES 
('John', 'Smith', '5557771234', 'CA', 'Los Angeles', 'Veteran', 'Veteran Family Referral', 'NEW', 'cnsysop@aoglobelife.com'),
('Lisa', 'Brown', '5557772345', 'TX', 'Houston', 'Plus', 'Insurance Plus', 'NEW', 'cnsysop@aoglobelife.com'),
('Mark', 'Wilson', '5557773456', 'FL', 'Tampa', 'Globe', 'Globe Life', 'NEW', 'cnsysop@aoglobelife.com')
ON CONFLICT (phone) DO NOTHING;

-- Insert sample hotleads data
INSERT INTO hotleads (
  first_name, last_name, phone, state, city, call_date, call_time, 
  duration_seconds, hot_lead_reason, priority_score, taalk_market, 
  taalk_groupname, status, cn_email
) VALUES 
('Michael', 'Johnson', '5551234567', 'TX', 'Dallas', CURRENT_DATE, '10:30:00',
 45, 'Human Answered - No Transfer', 5, 'Veteran', 'Hot Lead', 'NEW', 'cnsysop@aoglobelife.com'),
('Sarah', 'Williams', '5559876543', 'FL', 'Miami', CURRENT_DATE, '11:15:00',
 67, 'Human Answered - No Transfer', 5, 'Veteran', 'Hot Lead', 'NEW', 'cnsysop@aoglobelife.com'),
('Robert', 'Davis', '5555555555', 'CA', 'Los Angeles', CURRENT_DATE, '14:20:00',
 23, 'Transfer Lost Quickly', 5, 'Veteran', 'Hot Lead', 'NEW', 'cnsysop@aoglobelife.com')
ON CONFLICT (phone) DO NOTHING;

-- Success message
SELECT 'Minimal Supabase migration completed successfully! Core ConnectNow tables created.' as migration_status;