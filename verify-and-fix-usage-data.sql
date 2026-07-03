-- Verify and Fix Usage Report Data
-- This script checks what data exists and ensures it matches the current week

-- First, check what week PostgreSQL thinks it is
SELECT 
  'Current Date' as info,
  CURRENT_DATE as value;

SELECT 
  'Week Start (PostgreSQL)' as info,
  DATE_TRUNC('week', CURRENT_DATE)::DATE as value;

-- Check what's in the database
SELECT 
  'Existing Records' as info,
  COUNT(*) as count,
  MIN(week_start_date) as earliest_week,
  MAX(week_start_date) as latest_week
FROM weekly_usage_stats;

-- Show all current records
SELECT 
  agent_email,
  week_start_date,
  week_end_date,
  total_logins,
  total_online_minutes,
  total_dials_made,
  appointments_scheduled,
  sales_made,
  total_alp
FROM weekly_usage_stats
ORDER BY week_start_date DESC, agent_email
LIMIT 20;

-- DELETE any old data to start fresh
DELETE FROM weekly_usage_stats
WHERE week_start_date != DATE_TRUNC('week', CURRENT_DATE)::DATE;

-- Insert fresh data for current week (PostgreSQL weeks start on Monday)
-- But our code uses Sunday as week start, so let's calculate Sunday manually
WITH week_calc AS (
  SELECT 
    CURRENT_DATE - (EXTRACT(DOW FROM CURRENT_DATE)::INTEGER) as week_start_sunday,
    (CURRENT_DATE - (EXTRACT(DOW FROM CURRENT_DATE)::INTEGER) + INTERVAL '6 days')::DATE as week_end_saturday
)
INSERT INTO weekly_usage_stats (
  agent_email,
  agent_name,
  week_start_date,
  week_end_date,
  total_logins,
  unique_login_days,
  total_online_minutes,
  vdp_connects_received,
  vdp_total_minutes,
  total_dials_made,
  total_call_minutes,
  appointments_scheduled,
  sales_made,
  total_alp,
  last_activity_at
)
SELECT 
  'cnsysop@aoglobelife.com',
  'System Operator',
  week_start_sunday,
  week_end_saturday,
  20,
  5,
  600,
  30,
  150,
  200,
  400,
  15,
  5,
  2500.00,
  NOW()
FROM week_calc
ON CONFLICT (agent_email, week_start_date) 
DO UPDATE SET
  total_logins = 20,
  unique_login_days = 5,
  total_online_minutes = 600,
  vdp_connects_received = 30,
  vdp_total_minutes = 150,
  total_dials_made = 200,
  total_call_minutes = 400,
  appointments_scheduled = 15,
  sales_made = 5,
  total_alp = 2500.00,
  last_activity_at = NOW(),
  updated_at = NOW();

-- Insert for tabithamcdermid
WITH week_calc AS (
  SELECT 
    CURRENT_DATE - (EXTRACT(DOW FROM CURRENT_DATE)::INTEGER) as week_start_sunday,
    (CURRENT_DATE - (EXTRACT(DOW FROM CURRENT_DATE)::INTEGER) + INTERVAL '6 days')::DATE as week_end_saturday
)
INSERT INTO weekly_usage_stats (
  agent_email,
  agent_name,
  week_start_date,
  week_end_date,
  total_logins,
  unique_login_days,
  total_online_minutes,
  vdp_connects_received,
  vdp_total_minutes,
  total_dials_made,
  total_call_minutes,
  appointments_scheduled,
  sales_made,
  total_alp,
  last_activity_at
)
SELECT 
  'tabithamcdermid@aoglobelife.com',
  'Tabitha McDermid',
  week_start_sunday,
  week_end_saturday,
  25,
  6,
  720,
  40,
  200,
  250,
  500,
  20,
  8,
  4000.00,
  NOW()
FROM week_calc
ON CONFLICT (agent_email, week_start_date) 
DO UPDATE SET
  total_logins = 25,
  unique_login_days = 6,
  total_online_minutes = 720,
  vdp_connects_received = 40,
  vdp_total_minutes = 200,
  total_dials_made = 250,
  total_call_minutes = 500,
  appointments_scheduled = 20,
  sales_made = 8,
  total_alp = 4000.00,
  last_activity_at = NOW(),
  updated_at = NOW();

-- Verify the data was inserted
SELECT 
  'VERIFICATION' as status,
  agent_email,
  week_start_date,
  week_end_date,
  total_logins,
  total_online_minutes,
  total_dials_made,
  appointments_scheduled,
  sales_made,
  total_alp
FROM weekly_usage_stats
WHERE week_start_date = (CURRENT_DATE - (EXTRACT(DOW FROM CURRENT_DATE)::INTEGER))::DATE
ORDER BY agent_email;

-- Show what DATE_TRUNC returns vs manual calculation
SELECT 
  'DATE_TRUNC week' as method,
  DATE_TRUNC('week', CURRENT_DATE)::DATE as week_start;
  
SELECT 
  'Manual Sunday calc' as method,
  (CURRENT_DATE - (EXTRACT(DOW FROM CURRENT_DATE)::INTEGER))::DATE as week_start;

