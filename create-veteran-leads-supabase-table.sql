-- SQL script to create veteran_leads table in Supabase
-- Run this in the Supabase SQL Editor first, then run the migration script

CREATE TABLE IF NOT EXISTS "veteran_leads" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  status TEXT DEFAULT 'pending',
  call_attempts INTEGER DEFAULT 0,
  notes TEXT DEFAULT '',
  taalk_market TEXT,
  taalk_state TEXT,
  taalk_lead_id TEXT,
  taalk_group_code TEXT,
  taalk_email TEXT,
  taalk_lead_source TEXT,
  taalk_sponsor_org TEXT,
  taalk_referred TEXT,
  taalk_relationship TEXT,
  taalk_secret_key TEXT,
  taalk_city TEXT,
  taalk_zip TEXT,
  taalk_address TEXT,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  called_at TIMESTAMP WITH TIME ZONE,
  dnc BOOLEAN DEFAULT false,
  try_count INTEGER DEFAULT 0,
  answered BOOLEAN DEFAULT false,
  has_sent_sms BOOLEAN DEFAULT false,
  has_open_link BOOLEAN DEFAULT false,
  has_redirect_call BOOLEAN DEFAULT false,
  duration INTEGER,
  duration_after_transfer INTEGER,
  has_summary BOOLEAN DEFAULT false,
  disposition TEXT,
  last_called_at TIMESTAMP WITH TIME ZONE,
  call_disposition TEXT,
  disposition_notes TEXT,
  disposition_timestamp TIMESTAMP WITH TIME ZONE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_veteran_leads_user_email ON "veteran_leads"(user_email);
CREATE INDEX IF NOT EXISTS idx_veteran_leads_status ON "veteran_leads"(status);
CREATE INDEX IF NOT EXISTS idx_veteran_leads_phone ON "veteran_leads"(phone);
CREATE INDEX IF NOT EXISTS idx_veteran_leads_taalk_market ON "veteran_leads"(taalk_market);
CREATE INDEX IF NOT EXISTS idx_veteran_leads_taalk_state ON "veteran_leads"(taalk_state);
CREATE INDEX IF NOT EXISTS idx_veteran_leads_assigned_at ON "veteran_leads"(assigned_at);

-- Enable RLS (Row Level Security)
ALTER TABLE "veteran_leads" ENABLE ROW LEVEL SECURITY;

-- Create RLS policy to allow users to see their assigned leads
CREATE POLICY "Users can access their assigned leads" ON "veteran_leads"
  FOR ALL USING (user_email = current_setting('request.jwt.claims', true)::json->>'email');

-- Grant permissions for service role
GRANT ALL ON "veteran_leads" TO service_role;
GRANT ALL ON "veteran_leads" TO authenticated;

-- Insert a test record to verify table creation
INSERT INTO "veteran_leads" (
  user_email,
  first_name, 
  last_name, 
  phone, 
  email, 
  taalk_market,
  status
) VALUES (
  'chrislafond@aoglobelife.com',
  'Test',
  'Veteran', 
  '5551234567',
  'test@example.com',
  'Veteran',
  'pending'
);

-- Verify the table was created and test record inserted
SELECT COUNT(*) as table_count FROM "veteran_leads";
SELECT * FROM "veteran_leads" LIMIT 1;