-- COMPLETE SUPABASE MIGRATION SCRIPT
-- This migrates all ConnectNow tables from local PostgreSQL to Supabase

-- =====================================================
-- 1. USERS AND AUTHENTICATION
-- =====================================================

-- Users table (using TEXT primary key for compatibility)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  agent_phone TEXT,
  agent_name TEXT
);

-- Agent profiles
CREATE TABLE IF NOT EXISTS agent_profiles (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  supabase_user_id TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  zoom_id TEXT,
  zoom_password TEXT DEFAULT '1',
  profile_picture TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- User roles and permissions
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  permissions JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_roles (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT REFERENCES users(id),
  role_id TEXT REFERENCES roles(id),
  assigned_at TIMESTAMP DEFAULT NOW(),
  assigned_by TEXT
);

-- Admin system
CREATE TABLE IF NOT EXISTS admin_roles (
  id SERIAL PRIMARY KEY,
  user_email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  permissions JSONB DEFAULT '[]'::jsonb,
  assigned_at TIMESTAMP DEFAULT NOW(),
  assigned_by TEXT
);

CREATE TABLE IF NOT EXISTS admin_logs (
  id SERIAL PRIMARY KEY,
  admin_email TEXT NOT NULL,
  action TEXT NOT NULL,
  target_user TEXT,
  details JSONB,
  timestamp TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- 2. LEAD MANAGEMENT
-- =====================================================

-- Veteran leads
CREATE TABLE IF NOT EXISTS veteran_leads (
  id SERIAL PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
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
  taalk_address TEXT
);

-- Incoming leads
CREATE TABLE IF NOT EXISTS incoming_leads (
  id SERIAL PRIMARY KEY,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  referrer VARCHAR(255),
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(255),
  address_1 VARCHAR(500),
  city VARCHAR(255),
  state VARCHAR(10),
  postal_code VARCHAR(20),
  language VARCHAR(10) DEFAULT '1',
  cost VARCHAR(20),
  gender VARCHAR(20),
  querystring TEXT,
  status VARCHAR(50) DEFAULT 'new' NOT NULL,
  assigned_agent VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  processed_at TIMESTAMP
);

-- Recruit candidates
CREATE TABLE IF NOT EXISTS recruit_candidates (
  id SERIAL PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  position TEXT,
  experience TEXT,
  rating DECIMAL(3,1),
  notes TEXT,
  agent_id TEXT NOT NULL,
  agent_email TEXT NOT NULL,
  appointment_date TIMESTAMP,
  appointment_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- 3. HOTLEADS SYSTEM
-- =====================================================

-- Hotleads main table
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

-- Hot lead notifications
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

-- Hot lead callbacks
CREATE TABLE IF NOT EXISTS hot_lead_callbacks (
  id SERIAL PRIMARY KEY,
  phone_number TEXT NOT NULL,
  assigned_agent_email TEXT NOT NULL,
  hot_lead_id INTEGER REFERENCES hotleads(id),
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '24 hours'),
  is_active BOOLEAN DEFAULT true
);

-- =====================================================
-- 4. CALL TRACKING AND METRICS
-- =====================================================

-- Outbound calls
CREATE TABLE IF NOT EXISTS outbound_calls (
  id SERIAL PRIMARY KEY,
  twilio_call_sid TEXT NOT NULL UNIQUE,
  twilio_conference_sid TEXT,
  twilio_parent_call_sid TEXT,
  agent_email TEXT NOT NULL,
  agent_phone TEXT,
  agent_name TEXT,
  lead_name TEXT NOT NULL,
  lead_phone TEXT NOT NULL,
  lead_id TEXT,
  lead_market TEXT,
  lead_state TEXT,
  lead_city TEXT,
  call_status TEXT NOT NULL DEFAULT 'initiated',
  call_direction TEXT NOT NULL DEFAULT 'outbound',
  start_time TIMESTAMP DEFAULT NOW(),
  answer_time TIMESTAMP,
  end_time TIMESTAMP,
  duration INTEGER DEFAULT 0,
  call_quality DECIMAL(3,2),
  local_presence_number TEXT,
  recording_url TEXT,
  call_disposition TEXT,
  appointment_scheduled BOOLEAN DEFAULT false,
  appointment_date TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Outbound call history
CREATE TABLE IF NOT EXISTS outbound_call_history (
  id SERIAL PRIMARY KEY,
  lead_id TEXT NOT NULL,
  lead_name TEXT NOT NULL,
  lead_phone TEXT NOT NULL,
  agent_email TEXT NOT NULL,
  call_date TIMESTAMP DEFAULT NOW(),
  call_status TEXT,
  duration INTEGER DEFAULT 0,
  disposition TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Call center events
CREATE TABLE IF NOT EXISTS call_center_events (
  id SERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  call_id INTEGER REFERENCES outbound_calls(id),
  twilio_call_sid TEXT NOT NULL,
  agent_email TEXT NOT NULL,
  event_data JSONB,
  timestamp TIMESTAMP DEFAULT NOW()
);

-- Agent metrics
CREATE TABLE IF NOT EXISTS agent_metrics (
  id SERIAL PRIMARY KEY,
  agent_email TEXT NOT NULL,
  date TIMESTAMP NOT NULL,
  total_calls INTEGER DEFAULT 0,
  total_connects INTEGER DEFAULT 0,
  total_appointments INTEGER DEFAULT 0,
  connect_rate DECIMAL(5,2) DEFAULT 0.00,
  appointment_rate DECIMAL(5,2) DEFAULT 0.00,
  total_talk_time INTEGER DEFAULT 0,
  avg_call_duration DECIMAL(8,2) DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Call logs
CREATE TABLE IF NOT EXISTS call_logs (
  id SERIAL PRIMARY KEY,
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

-- WAR (Weekly Agency Report) system
CREATE TABLE IF NOT EXISTS war_connects (
  id SERIAL PRIMARY KEY,
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

CREATE TABLE IF NOT EXISTS war_submissions (
  id SERIAL PRIMARY KEY,
  agent_email TEXT NOT NULL,
  week_start TIMESTAMP NOT NULL,
  week_end TIMESTAMP NOT NULL,
  total_connects INTEGER NOT NULL,
  reported_connects INTEGER NOT NULL,
  submitted_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- 5. APPOINTMENT SYSTEM
-- =====================================================

-- Appointments
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

-- Agent availability
CREATE TABLE IF NOT EXISTS agent_availability (
  id SERIAL PRIMARY KEY,
  agent_email TEXT NOT NULL,
  day_of_week INTEGER NOT NULL,
  start_time INTEGER NOT NULL,
  end_time INTEGER NOT NULL,
  is_available BOOLEAN DEFAULT true,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  buffer_time INTEGER DEFAULT 15,
  max_advance_days INTEGER DEFAULT 30,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Appointment reminders
CREATE TABLE IF NOT EXISTS appointment_reminders (
  id SERIAL PRIMARY KEY,
  appointment_id INTEGER REFERENCES appointments(id) NOT NULL,
  reminder_type TEXT NOT NULL,
  reminder_time INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMP,
  delivered_at TIMESTAMP,
  error_message TEXT,
  message_content TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Agent notification settings
CREATE TABLE IF NOT EXISTS agent_notification_settings (
  id SERIAL PRIMARY KEY,
  agent_email TEXT NOT NULL UNIQUE,
  email_notifications BOOLEAN DEFAULT true,
  sms_notifications BOOLEAN DEFAULT false,
  push_notifications BOOLEAN DEFAULT true,
  reminder_before_appointment INTEGER DEFAULT 30,
  daily_summary BOOLEAN DEFAULT true,
  weekly_report BOOLEAN DEFAULT true,
  hot_lead_alerts BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- 6. VERIFICATION AND VIDEO SYSTEMS
-- =====================================================

-- Verification sessions
CREATE TABLE IF NOT EXISTS verification_sessions (
  id SERIAL PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  spouse_name TEXT,
  phone TEXT NOT NULL,
  agent_phone TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  premium TEXT NOT NULL,
  verification_method TEXT,
  zoom_room_id TEXT,
  zoom_password TEXT,
  language TEXT DEFAULT 'en',
  screenshot_path TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  sms_verification_sent BOOLEAN DEFAULT false,
  sms_verification_code TEXT,
  client_approval_status TEXT DEFAULT 'pending',
  client_approval_time TIMESTAMP,
  client_ip_address TEXT,
  client_country TEXT,
  client_region TEXT,
  client_city TEXT,
  client_latitude TEXT,
  client_longitude TEXT,
  client_timezone TEXT,
  client_isp TEXT,
  client_user_agent TEXT,
  agent_ip_address TEXT,
  agent_country TEXT,
  agent_region TEXT,
  agent_city TEXT,
  agent_latitude TEXT,
  agent_longitude TEXT,
  agent_timezone TEXT,
  agent_isp TEXT,
  agent_user_agent TEXT,
  call_completed BOOLEAN DEFAULT false,
  verification_result TEXT,
  taalk_call_id TEXT,
  taalk_call_status TEXT,
  taalk_call_initiated_at TEXT,
  taalk_call_completed_at TEXT,
  taalk_call_duration INTEGER,
  taalk_call_data TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Video sessions
CREATE TABLE IF NOT EXISTS video_sessions (
  id SERIAL PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE,
  room_name TEXT NOT NULL,
  agent_email TEXT NOT NULL,
  client_name TEXT,
  client_phone TEXT,
  status TEXT DEFAULT 'waiting',
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  duration INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- VDP (Voice Data Processing) calls
CREATE TABLE IF NOT EXISTS vdp_calls (
  id SERIAL PRIMARY KEY,
  call_id TEXT NOT NULL UNIQUE,
  from_number TEXT NOT NULL,
  to_number TEXT NOT NULL,
  agent_email TEXT,
  status TEXT DEFAULT 'pending',
  duration INTEGER DEFAULT 0,
  recording_url TEXT,
  disposition TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- =====================================================
-- 7. GAMIFICATION AND USER EXPERIENCE
-- =====================================================

-- User experience points
CREATE TABLE IF NOT EXISTS user_experience (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  total_experience INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  experience_to_next_level INTEGER NOT NULL DEFAULT 100,
  connects_reviewed INTEGER NOT NULL DEFAULT 0,
  sales_made INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- User game stats
CREATE TABLE IF NOT EXISTS user_game_stats (
  id SERIAL PRIMARY KEY,
  user_email TEXT NOT NULL UNIQUE,
  total_points INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  achievements JSONB DEFAULT '[]'::jsonb,
  badges JSONB DEFAULT '[]'::jsonb,
  streak_days INTEGER DEFAULT 0,
  last_activity TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- User credits
CREATE TABLE IF NOT EXISTS user_credits (
  id SERIAL PRIMARY KEY,
  user_email TEXT NOT NULL,
  credits_available INTEGER DEFAULT 0,
  credits_used INTEGER DEFAULT 0,
  last_reset_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- 8. COMPETITION AND LEADERBOARD
-- =====================================================

-- Leaderboard
CREATE TABLE IF NOT EXISTS leaderboard (
  id SERIAL PRIMARY KEY,
  agent_email TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  total_calls INTEGER DEFAULT 0,
  total_connects INTEGER DEFAULT 0,
  total_appointments INTEGER DEFAULT 0,
  total_sales INTEGER DEFAULT 0,
  points INTEGER DEFAULT 0,
  rank INTEGER,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- July contest data
CREATE TABLE IF NOT EXISTS july_contest_data (
  id SERIAL PRIMARY KEY,
  agent_email TEXT NOT NULL,
  agent_name TEXT,
  calls_made INTEGER DEFAULT 0,
  connects INTEGER DEFAULT 0,
  appointments INTEGER DEFAULT 0,
  sales INTEGER DEFAULT 0,
  points INTEGER DEFAULT 0,
  week_ending DATE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Teams
CREATE TABLE IF NOT EXISTS teams (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  team_lead_email TEXT,
  members JSONB DEFAULT '[]'::jsonb,
  goals JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- 9. COMMUNICATION SYSTEMS
-- =====================================================

-- Incoming calls
CREATE TABLE IF NOT EXISTS incoming_calls (
  id SERIAL PRIMARY KEY,
  call_sid TEXT NOT NULL UNIQUE,
  from_number TEXT NOT NULL,
  to_number TEXT NOT NULL,
  agent_email TEXT,
  call_status TEXT DEFAULT 'incoming',
  duration INTEGER DEFAULT 0,
  recording_url TEXT,
  disposition TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  answered_at TIMESTAMP,
  ended_at TIMESTAMP
);

-- Inbound call routing
CREATE TABLE IF NOT EXISTS inbound_call_routing (
  id SERIAL PRIMARY KEY,
  phone_number TEXT NOT NULL,
  routing_type TEXT NOT NULL DEFAULT 'agent',
  destination TEXT NOT NULL,
  priority INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  business_hours_only BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ConnectNow users
CREATE TABLE IF NOT EXISTS connectnow_users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role TEXT DEFAULT 'agent',
  status TEXT DEFAULT 'active',
  last_login TIMESTAMP,
  preferences JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- 10. INDEXES FOR PERFORMANCE
-- =====================================================

-- Hotleads indexes
CREATE INDEX IF NOT EXISTS idx_hotleads_cn_email ON hotleads(cn_email);
CREATE INDEX IF NOT EXISTS idx_hotleads_status ON hotleads(status);
CREATE INDEX IF NOT EXISTS idx_hotleads_priority_score ON hotleads(priority_score);
CREATE INDEX IF NOT EXISTS idx_hotleads_call_date ON hotleads(call_date);

-- Call tracking indexes
CREATE INDEX IF NOT EXISTS idx_outbound_calls_agent_email ON outbound_calls(agent_email);
CREATE INDEX IF NOT EXISTS idx_outbound_calls_twilio_sid ON outbound_calls(twilio_call_sid);
CREATE INDEX IF NOT EXISTS idx_outbound_calls_start_time ON outbound_calls(start_time);

-- WAR system indexes
CREATE INDEX IF NOT EXISTS idx_war_connects_agent_email ON war_connects(agent_email);
CREATE INDEX IF NOT EXISTS idx_war_connects_connect_date ON war_connects(connect_date);

-- Appointment indexes
CREATE INDEX IF NOT EXISTS idx_appointments_agent_email ON appointments(agent_email);
CREATE INDEX IF NOT EXISTS idx_appointments_start_time ON appointments(start_time);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);

-- Lead indexes
CREATE INDEX IF NOT EXISTS idx_veteran_leads_phone ON veteran_leads(phone);
CREATE INDEX IF NOT EXISTS idx_veteran_leads_state ON veteran_leads(state);
CREATE INDEX IF NOT EXISTS idx_incoming_leads_status ON incoming_leads(status);

-- Notification indexes
CREATE INDEX IF NOT EXISTS idx_hot_lead_notifications_agent_email ON hot_lead_notifications(agent_email);
CREATE INDEX IF NOT EXISTS idx_hot_lead_callbacks_agent_email ON hot_lead_callbacks(assigned_agent_email);
CREATE INDEX IF NOT EXISTS idx_hot_lead_callbacks_phone ON hot_lead_callbacks(phone_number);

-- =====================================================
-- 11. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotleads ENABLE ROW LEVEL SECURITY;
ALTER TABLE hot_lead_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE hot_lead_callbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbound_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE war_connects ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_sessions ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for all tables (you can restrict these later)
CREATE POLICY "Enable all access for authenticated users" ON users FOR ALL USING (true);
CREATE POLICY "Enable all access for authenticated users" ON agent_profiles FOR ALL USING (true);
CREATE POLICY "Enable all access for authenticated users" ON hotleads FOR ALL USING (true);
CREATE POLICY "Enable all access for authenticated users" ON hot_lead_notifications FOR ALL USING (true);
CREATE POLICY "Enable all access for authenticated users" ON hot_lead_callbacks FOR ALL USING (true);
CREATE POLICY "Enable all access for authenticated users" ON outbound_calls FOR ALL USING (true);
CREATE POLICY "Enable all access for authenticated users" ON appointments FOR ALL USING (true);
CREATE POLICY "Enable all access for authenticated users" ON war_connects FOR ALL USING (true);
CREATE POLICY "Enable all access for authenticated users" ON verification_sessions FOR ALL USING (true);

-- =====================================================
-- 12. TRIGGERS FOR AUTO-UPDATING TIMESTAMPS
-- =====================================================

-- Create function for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for tables with updated_at columns
CREATE TRIGGER update_agent_profiles_updated_at 
  BEFORE UPDATE ON agent_profiles 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_hotleads_updated_at 
  BEFORE UPDATE ON hotleads 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_outbound_calls_updated_at 
  BEFORE UPDATE ON outbound_calls 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at 
  BEFORE UPDATE ON appointments 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_war_connects_updated_at 
  BEFORE UPDATE ON war_connects 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_experience_updated_at 
  BEFORE UPDATE ON user_experience 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

-- Insert essential data
INSERT INTO roles (name, description, permissions) VALUES 
('admin', 'Administrator with full access', '["read", "write", "delete", "admin"]'::jsonb),
('agent', 'Sales agent with lead access', '["read", "write"]'::jsonb),
('viewer', 'Read-only access', '["read"]'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- Success message
SELECT 'Supabase migration completed successfully! All ConnectNow tables have been created.' as migration_status;