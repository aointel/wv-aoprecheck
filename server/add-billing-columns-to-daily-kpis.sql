-- Add billing columns to connectnow_daily_kpis table
-- Run this in Supabase SQL Editor to add the missing columns

ALTER TABLE connectnow_daily_kpis 
ADD COLUMN IF NOT EXISTS precheck_billed INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS precheck_sign_ups INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS call_connector_pro_active_accounts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS call_connector_pro_sign_ups INTEGER DEFAULT 0;

-- Verify columns were added
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'connectnow_daily_kpis'
  AND column_name IN ('precheck_billed', 'precheck_sign_ups', 'call_connector_pro_active_accounts', 'call_connector_pro_sign_ups')
ORDER BY ordinal_position;

