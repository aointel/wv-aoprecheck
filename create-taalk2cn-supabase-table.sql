-- SQL script to create Taalk2CN table in Supabase
-- Run this in the Supabase SQL Editor first, then run the migration script

CREATE TABLE IF NOT EXISTS "Taalk2CN" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firstname TEXT,
  lastname TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  "CNEmail" TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  call_attempts INTEGER DEFAULT 0,
  notes TEXT DEFAULT '',
  taalk_market TEXT,
  taalk_state TEXT,
  taalk_leadid TEXT,
  taalk_groupcode TEXT,
  taalk_email TEXT,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_taalk2cn_cnemail ON "Taalk2CN"("CNEmail");
CREATE INDEX IF NOT EXISTS idx_taalk2cn_status ON "Taalk2CN"(status);
CREATE INDEX IF NOT EXISTS idx_taalk2cn_phone ON "Taalk2CN"(phone);
CREATE INDEX IF NOT EXISTS idx_taalk2cn_market ON "Taalk2CN"(taalk_market);

-- Enable RLS (Row Level Security)
ALTER TABLE "Taalk2CN" ENABLE ROW LEVEL SECURITY;

-- Create RLS policy to allow users to see their assigned leads
CREATE POLICY "Users can access their assigned leads" ON "Taalk2CN"
  FOR ALL USING ("CNEmail" = current_setting('request.jwt.claims', true)::json->>'email');

-- Grant permissions for service role
GRANT ALL ON "Taalk2CN" TO service_role;
GRANT ALL ON "Taalk2CN" TO authenticated;

-- Insert a test record to verify table creation
INSERT INTO "Taalk2CN" (
  firstname, 
  lastname, 
  phone, 
  email, 
  "CNEmail", 
  taalk_market,
  status
) VALUES (
  'Test',
  'Lead', 
  '5551234567',
  'test@example.com',
  'chrislafond@aoglobelife.com',
  'Veteran',
  'pending'
);

-- Verify the table was created and test record inserted
SELECT COUNT(*) as table_count FROM "Taalk2CN";
SELECT * FROM "Taalk2CN" LIMIT 1;