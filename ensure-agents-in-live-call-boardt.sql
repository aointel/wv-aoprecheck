-- ============================================================================
-- Ensure agents in agent_hierarchy are also in live_call_boardt
-- ============================================================================
-- This script inserts agents from agent_hierarchy into live_call_boardt
-- if they don't already exist, so they show up in the Live Call Board
-- even if they haven't made calls today yet
-- ============================================================================

-- Insert agents from agent_hierarchy into live_call_boardt if they don't exist
INSERT INTO live_call_boardt (
  agent_email,
  agent_name,
  status,
  today_dialed,
  today_reached,
  today_booked,
  today_presentations,
  today_sales,
  updated_at
)
SELECT 
  ah.agent_email,
  ah.agent_name,
  'offline' as status,
  0 as today_dialed,
  0 as today_reached,
  0 as today_booked,
  0 as today_presentations,
  0 as today_sales,
  NOW() as updated_at
FROM agent_hierarchy ah
WHERE ah.agent_email IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 
    FROM live_call_boardt lcb 
    WHERE LOWER(lcb.agent_email) = LOWER(ah.agent_email)
  )
ON CONFLICT (agent_email) DO NOTHING;

-- Verification: Show agents under Carrington Hanna and whether they're in live_call_boardt
SELECT 
  ah.agent_email,
  ah.agent_name,
  ah.mga_name,
  CASE 
    WHEN lcb.agent_email IS NOT NULL THEN '✅ YES - in live_call_boardt'
    ELSE '❌ NO - not in live_call_boardt'
  END as in_live_board,
  lcb.today_dialed,
  lcb.today_reached,
  lcb.today_booked,
  lcb.status
FROM agent_hierarchy ah
LEFT JOIN live_call_boardt lcb ON LOWER(lcb.agent_email) = LOWER(ah.agent_email)
WHERE ah.mga_associate_id = (
  SELECT associate_id 
  FROM customers 
  WHERE company_email = 'carringtonhanna@aoglobelife.com' 
     OR personal_email = 'carringtonhanna@aoglobelife.com'
  LIMIT 1
)
ORDER BY ah.agent_email;

