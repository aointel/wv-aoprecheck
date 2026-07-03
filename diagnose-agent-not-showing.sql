-- ============================================================================
-- DIAGNOSTIC: Why is an agent not showing under Carrington Hanna?
-- ============================================================================

-- 1. Check Carrington Hanna's associate_id
SELECT 
  'Carrington Hanna Info' as check_type,
  associate_id,
  first_name,
  last_name,
  company_email,
  personal_email
FROM customers
WHERE company_email = 'carringtonhanna@aoglobelife.com'
   OR personal_email = 'carringtonhanna@aoglobelife.com';

-- 2. Check ALL agents under Carrington Hanna in agent_hierarchy
SELECT 
  'Agents under Carrington Hanna' as check_type,
  ah.agent_email,
  ah.agent_name,
  ah.agent_associate_id,
  ah.mga_name,
  ah.mga_associate_id,
  ah.rga_name,
  ah.rga_associate_id,
  CASE 
    WHEN lcb.agent_email IS NOT NULL THEN '✅ In live_call_boardt'
    ELSE '❌ NOT in live_call_boardt'
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

-- 3. Check if bradleesimmons specifically is in hierarchy
SELECT 
  'Bradlee Simmons Check' as check_type,
  ah.agent_email,
  ah.agent_name,
  ah.agent_associate_id,
  ah.mga_name,
  ah.mga_associate_id,
  ah.rga_name,
  ah.rga_associate_id,
  CASE 
    WHEN ah.mga_associate_id = (SELECT associate_id FROM customers WHERE company_email = 'carringtonhanna@aoglobelife.com' OR personal_email = 'carringtonhanna@aoglobelife.com' LIMIT 1)
    THEN '✅ Under Carrington Hanna'
    ELSE '❌ NOT under Carrington Hanna'
  END as is_under_carrington
FROM agent_hierarchy ah
WHERE ah.agent_email ILIKE '%bradleesimmons%'
   OR ah.agent_email = 'bradleesimmons@aoglobelife.com';

-- 4. Check ALL agents that should be under Carrington (from the list we tied)
SELECT 
  'All Tied Agents Check' as check_type,
  ah.agent_email,
  ah.agent_name,
  ah.mga_name,
  ah.mga_associate_id,
  CASE 
    WHEN ah.mga_associate_id = (SELECT associate_id FROM customers WHERE company_email = 'carringtonhanna@aoglobelife.com' OR personal_email = 'carringtonhanna@aoglobelife.com' LIMIT 1)
    THEN '✅ Correct'
    ELSE '❌ WRONG MGA'
  END as status
FROM agent_hierarchy ah
WHERE ah.agent_email IN (
  'cameronchristensen@aoglobelife.com',
  'calebbrown@aoglobelife.com',
  'gavinsynder@aoglobelife.com',
  'bradleesimmons@aoglobelife.com',
  'isaiahnewhouse@aoglobelife.com',
  'shawnsipes@aoglobelife.com',
  'averyflicky@aoglobelife.com',
  'tajward@aoglobelife.com',
  'alonzoalexander@aoglobelife.com',
  'willmusik@aoglobelife.com'
)
ORDER BY ah.agent_email;

-- 5. Check what the API would see - all unique agents from both tables
SELECT 
  'API View - All Agents' as check_type,
  COALESCE(lcb.agent_email, ah.agent_email) as agent_email,
  CASE 
    WHEN lcb.agent_email IS NOT NULL THEN 'From live_call_boardt'
    WHEN ah.agent_email IS NOT NULL THEN 'From agent_hierarchy only'
    ELSE 'Unknown'
  END as source,
  ah.mga_name,
  ah.mga_associate_id
FROM live_call_boardt lcb
FULL OUTER JOIN agent_hierarchy ah ON LOWER(lcb.agent_email) = LOWER(ah.agent_email)
WHERE ah.mga_associate_id = (
  SELECT associate_id 
  FROM customers 
  WHERE company_email = 'carringtonhanna@aoglobelife.com' 
     OR personal_email = 'carringtonhanna@aoglobelife.com'
  LIMIT 1
)
ORDER BY COALESCE(lcb.agent_email, ah.agent_email);

