-- ============================================================================
-- Check why bradleesimmons is not showing up under Carrington Hanna
-- ============================================================================

-- 1. Check if bradleesimmons exists in agent_hierarchy with Carrington Hanna
SELECT 
  'agent_hierarchy' as source,
  agent_email,
  agent_name,
  agent_associate_id,
  mga_name,
  mga_associate_id,
  rga_name,
  rga_associate_id
FROM agent_hierarchy
WHERE agent_email = 'bradleesimmons@aoglobelife.com'
   OR agent_email ILIKE '%bradleesimmons%';

-- 2. Check if bradleesimmons exists in live_call_boardt (the table the API reads from)
SELECT 
  'live_call_boardt' as source,
  agent_email,
  agent_name,
  today_dialed,
  today_reached,
  today_booked,
  status,
  updated_at
FROM live_call_boardt
WHERE agent_email = 'bradleesimmons@aoglobelife.com'
   OR agent_email ILIKE '%bradleesimmons%';

-- 3. Check Carrington Hanna's associate_id
SELECT 
  'carrington_hanna' as source,
  associate_id,
  first_name,
  last_name,
  company_email,
  personal_email
FROM customers
WHERE company_email = 'carringtonhanna@aoglobelife.com'
   OR personal_email = 'carringtonhanna@aoglobelife.com';

-- 4. Check all agents under Carrington Hanna
SELECT 
  ah.agent_email,
  ah.agent_name,
  ah.agent_associate_id,
  ah.mga_name,
  ah.mga_associate_id,
  CASE 
    WHEN lcb.agent_email IS NOT NULL THEN 'YES - in live_call_boardt'
    ELSE 'NO - not in live_call_boardt'
  END as in_live_board
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

-- 5. Check if bradleesimmons exists in customers table
SELECT 
  'customers' as source,
  associate_id,
  first_name,
  last_name,
  company_email,
  personal_email
FROM customers
WHERE company_email = 'bradleesimmons@aoglobelife.com'
   OR personal_email = 'bradleesimmons@aoglobelife.com'
   OR company_email ILIKE '%bradleesimmons%'
   OR personal_email ILIKE '%bradleesimmons%';

