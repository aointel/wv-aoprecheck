-- Insert test usage data for the CURRENT WEEK to test the Usage Report frontend

-- First, check what the current week is
DO $$
DECLARE
  current_week_start DATE;
  current_week_end DATE;
BEGIN
  current_week_start := DATE_TRUNC('week', CURRENT_DATE)::DATE;
  current_week_end := (DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '6 days')::DATE;
  
  RAISE NOTICE 'Current week: % to %', current_week_start, current_week_end;
END $$;

-- Insert test data for cnsysop (yourself) for the current week
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
) VALUES (
  'cnsysop@aoglobelife.com',
  'System Operator',
  DATE_TRUNC('week', CURRENT_DATE)::DATE,
  (DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '6 days')::DATE,
  15,  -- 15 logins
  5,   -- 5 unique days
  480, -- 8 hours online
  25,  -- 25 VDP connects
  120, -- 2 hours VDP time
  150, -- 150 dials
  300, -- 5 hours call time
  12,  -- 12 appointments
  3,   -- 3 sales
  1500.00, -- $1500 ALP
  NOW()
)
ON CONFLICT (agent_email, week_start_date) 
DO UPDATE SET
  total_logins = 15,
  unique_login_days = 5,
  total_online_minutes = 480,
  vdp_connects_received = 25,
  vdp_total_minutes = 120,
  total_dials_made = 150,
  total_call_minutes = 300,
  appointments_scheduled = 12,
  sales_made = 3,
  total_alp = 1500.00,
  last_activity_at = NOW(),
  updated_at = NOW();

-- Insert test data for tabithamcdermid for the current week
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
) VALUES (
  'tabithamcdermid@aoglobelife.com',
  'Tabitha McDermid',
  DATE_TRUNC('week', CURRENT_DATE)::DATE,
  (DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '6 days')::DATE,
  20,  -- 20 logins
  5,   -- 5 unique days
  600, -- 10 hours online
  30,  -- 30 VDP connects
  150, -- 2.5 hours VDP time
  200, -- 200 dials
  400, -- 6.67 hours call time
  15,  -- 15 appointments
  5,   -- 5 sales
  2500.00, -- $2500 ALP
  NOW()
)
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

-- Verify the data was inserted
SELECT 
  agent_email,
  week_start_date,
  total_logins,
  total_online_minutes,
  total_dials_made,
  appointments_scheduled,
  sales_made,
  total_alp
FROM weekly_usage_stats
WHERE week_start_date = DATE_TRUNC('week', CURRENT_DATE)::DATE
ORDER BY agent_email;

