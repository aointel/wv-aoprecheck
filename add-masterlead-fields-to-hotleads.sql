-- SQL to add all masterlead fields to hotleads table
-- Run this in your Supabase SQL editor or database console

ALTER TABLE hotleads 
ADD COLUMN IF NOT EXISTS taalk_market text,
ADD COLUMN IF NOT EXISTS taalk_state text,
ADD COLUMN IF NOT EXISTS taalk_city text,
ADD COLUMN IF NOT EXISTS taalk_email text,
ADD COLUMN IF NOT EXISTS taalk_address text,
ADD COLUMN IF NOT EXISTS taalk_beneficiary text,
ADD COLUMN IF NOT EXISTS taalk_relationship text,
ADD COLUMN IF NOT EXISTS taalk_reffered text,
ADD COLUMN IF NOT EXISTS taalk_sponsor_org text,
ADD COLUMN IF NOT EXISTS taalk_group_code text,
ADD COLUMN IF NOT EXISTS taalk_groupname text,
ADD COLUMN IF NOT EXISTS taalk_lead_id text,
ADD COLUMN IF NOT EXISTS taalk_lead_source text,
ADD COLUMN IF NOT EXISTS cn_email text,
ADD COLUMN IF NOT EXISTS cnresolution text,
ADD COLUMN IF NOT EXISTS last_contacted timestamp with time zone,
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now(),
ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();

-- Update existing hotleads with proper field mappings
UPDATE hotleads 
SET 
  taalk_state = 'Unknown',
  taalk_city = 'Unknown',
  taalk_email = email,
  taalk_address = '',
  taalk_groupname = 'Hot Lead',
  taalk_market = 'Hot Lead',
  taalk_lead_source = 'Taalk AI',
  taalk_lead_id = id::text,
  cnresolution = 'pending',
  cn_email = 'cnsysop@aoglobelife.com',
  taalk_beneficiary = CONCAT(first_name, ' ', last_name),
  taalk_relationship = 'Self',
  taalk_reffered = 'Taalk AI',
  taalk_sponsor_org = 'AO Intelligence',
  taalk_group_code = 'HOTLEAD',
  updated_at = now(),
  last_contacted = null
WHERE taalk_state IS NULL;