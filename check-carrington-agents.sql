-- Check if Carrington Hanna has any agents under her

-- 1. Get Carrington's associate_id
SELECT 
  'Carrington Associate ID' as info,
  associate_id,
  first_name,
  last_name,
  company_email
FROM customers
WHERE company_email = 'carringtonhanna@aoglobelife.com';

-- 2. Check if she's an MGA with agents
SELECT 
  'Agents under Carrington as MGA' as info,
  COUNT(*) as agent_count
FROM agent_hierarchy
WHERE mga_associate_id = (
  SELECT associate_id 
  FROM customers 
  WHERE company_email = 'carringtonhanna@aoglobelife.com'
);

-- 3. Check if she's an RGA with agents
SELECT 
  'Agents under Carrington as RGA' as info,
  COUNT(*) as agent_count
FROM agent_hierarchy
WHERE rga_associate_id = (
  SELECT associate_id 
  FROM customers 
  WHERE company_email = 'carringtonhanna@aoglobelife.com'
);

-- 4. List all agents under her (if any)
SELECT 
  ap.email,
  ap.first_name,
  ap.last_name,
  ah.mga_associate_id,
  ah.rga_associate_id,
  CASE 
    WHEN ah.mga_associate_id = (SELECT associate_id FROM customers WHERE company_email = 'carringtonhanna@aoglobelife.com') THEN 'MGA'
    WHEN ah.rga_associate_id = (SELECT associate_id FROM customers WHERE company_email = 'carringtonhanna@aoglobelife.com') THEN 'RGA'
  END as relationship
FROM agent_hierarchy ah
JOIN agent_profiles ap ON ap.email = ah.agent_email
WHERE ah.mga_associate_id = (SELECT associate_id FROM customers WHERE company_email = 'carringtonhanna@aoglobelife.com')
   OR ah.rga_associate_id = (SELECT associate_id FROM customers WHERE company_email = 'carringtonhanna@aoglobelife.com');

