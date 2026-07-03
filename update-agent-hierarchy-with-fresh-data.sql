-- Update agent_hierarchy with fresh data from customers and producerlist
-- This script updates existing records and ensures all data is current
--
-- IMPORTANT: Run this script in Supabase SQL Editor to refresh agent_hierarchy data
-- This will update existing records with current data from source tables

-- Step 1: Update existing records from customers table (primary source)
UPDATE agent_hierarchy ah
SET
  agent_name = COALESCE(
    NULLIF(TRIM(c.first_name || ' ' || c.last_name), ''),
    ah.agent_name
  ),
  agent_email = COALESCE(
    LOWER(TRIM(c.company_email)),
    LOWER(TRIM(c.personal_email)),
    ah.agent_email
  ),
  updated_at = NOW()
FROM customers c
WHERE (ah.agent_associate_id = c.associate_id 
   OR LOWER(TRIM(ah.agent_email)) = LOWER(TRIM(c.company_email))
   OR LOWER(TRIM(ah.agent_email)) = LOWER(TRIM(c.personal_email)))
  AND c.associate_id IS NOT NULL;

-- Step 2: Update existing records with MGA/RGA data from producerlist (secondary source)
UPDATE agent_hierarchy ah
SET
  agent_name = COALESCE(ah.agent_name, p.agent_name, p.name),
  agent_email = COALESCE(ah.agent_email, LOWER(TRIM(p.company_email))),
  mga_name = COALESCE(p.mga, ah.mga_name),
  rga_name = COALESCE(p.rga, ah.rga_name),
  mga_associate_id = COALESCE(
    (SELECT associate_id FROM producerlist WHERE LOWER(TRIM(agent_name)) = LOWER(TRIM(p.mga)) OR LOWER(TRIM(name)) = LOWER(TRIM(p.mga)) LIMIT 1),
    ah.mga_associate_id
  ),
  rga_associate_id = COALESCE(
    (SELECT associate_id FROM producerlist WHERE LOWER(TRIM(agent_name)) = LOWER(TRIM(p.rga)) OR LOWER(TRIM(name)) = LOWER(TRIM(p.rga)) LIMIT 1),
    ah.rga_associate_id
  ),
  updated_at = NOW()
FROM producerlist p
WHERE (ah.agent_associate_id = p.associate_id 
   OR LOWER(TRIM(ah.agent_email)) = LOWER(TRIM(p.company_email)))
  AND p.associate_id IS NOT NULL;

-- Step 3: Add missing agents from customers table (primary source)
INSERT INTO agent_hierarchy (
  agent_associate_id,
  agent_name,
  agent_email,
  created_at,
  updated_at
)
SELECT DISTINCT
  c.associate_id as agent_associate_id,
  COALESCE(NULLIF(TRIM(c.first_name || ' ' || c.last_name), ''), 'Unknown') as agent_name,
  LOWER(TRIM(COALESCE(c.company_email, c.personal_email))) as agent_email,
  NOW() as created_at,
  NOW() as updated_at
FROM customers c
WHERE c.associate_id IS NOT NULL
  AND (c.company_email IS NOT NULL OR c.personal_email IS NOT NULL)
  AND LOWER(TRIM(COALESCE(c.company_email, c.personal_email))) LIKE '%@aoglobelife.com'
  -- Only insert if agent doesn't already exist in agent_hierarchy
  AND NOT EXISTS (
    SELECT 1 FROM agent_hierarchy ah 
    WHERE ah.agent_associate_id = c.associate_id
       OR LOWER(TRIM(ah.agent_email)) = LOWER(TRIM(COALESCE(c.company_email, c.personal_email)))
  )
ON CONFLICT (agent_associate_id) DO NOTHING;

-- Step 4: Add missing agents from producerlist table (secondary source, with MGA/RGA)
INSERT INTO agent_hierarchy (
  agent_associate_id,
  agent_name,
  agent_email,
  mga_name,
  rga_name,
  mga_associate_id,
  rga_associate_id,
  created_at,
  updated_at
)
SELECT DISTINCT
  p.associate_id as agent_associate_id,
  COALESCE(p.agent_name, p.name, 'Unknown') as agent_name,
  LOWER(TRIM(p.company_email)) as agent_email,
  p.mga as mga_name,
  p.rga as rga_name,
  -- Try to find MGA associate_id by looking up mga name in producerlist
  (SELECT associate_id FROM producerlist WHERE LOWER(TRIM(agent_name)) = LOWER(TRIM(p.mga)) OR LOWER(TRIM(name)) = LOWER(TRIM(p.mga)) LIMIT 1) as mga_associate_id,
  -- Try to find RGA associate_id by looking up rga name in producerlist
  (SELECT associate_id FROM producerlist WHERE LOWER(TRIM(agent_name)) = LOWER(TRIM(p.rga)) OR LOWER(TRIM(name)) = LOWER(TRIM(p.rga)) LIMIT 1) as rga_associate_id,
  NOW() as created_at,
  NOW() as updated_at
FROM producerlist p
WHERE p.associate_id IS NOT NULL
  AND p.company_email IS NOT NULL
  AND LOWER(TRIM(p.company_email)) LIKE '%@aoglobelife.com'
  -- Only insert if agent doesn't already exist in agent_hierarchy
  AND NOT EXISTS (
    SELECT 1 FROM agent_hierarchy ah 
    WHERE ah.agent_associate_id = p.associate_id
       OR LOWER(TRIM(ah.agent_email)) = LOWER(TRIM(p.company_email))
  )
ON CONFLICT (agent_associate_id) DO UPDATE SET
  agent_name = EXCLUDED.agent_name,
  agent_email = EXCLUDED.agent_email,
  mga_name = EXCLUDED.mga_name,
  rga_name = EXCLUDED.rga_name,
  mga_associate_id = EXCLUDED.mga_associate_id,
  rga_associate_id = EXCLUDED.rga_associate_id,
  updated_at = NOW();

-- Step 5: Update MGA/RGA associate_ids for all records (refresh lookups)
UPDATE agent_hierarchy ah
SET
  mga_associate_id = (
    SELECT associate_id FROM producerlist 
    WHERE LOWER(TRIM(agent_name)) = LOWER(TRIM(ah.mga_name)) 
       OR LOWER(TRIM(name)) = LOWER(TRIM(ah.mga_name)) 
    LIMIT 1
  ),
  rga_associate_id = (
    SELECT associate_id FROM producerlist 
    WHERE LOWER(TRIM(agent_name)) = LOWER(TRIM(ah.rga_name)) 
       OR LOWER(TRIM(name)) = LOWER(TRIM(ah.rga_name)) 
    LIMIT 1
  ),
  updated_at = NOW()
WHERE (ah.mga_name IS NOT NULL OR ah.rga_name IS NOT NULL);

-- Summary query to see what was updated
SELECT 
  'Total agents in agent_hierarchy' as metric,
  COUNT(*) as count
FROM agent_hierarchy
UNION ALL
SELECT 
  'Agents with MGA' as metric,
  COUNT(*) as count
FROM agent_hierarchy
WHERE mga_name IS NOT NULL
UNION ALL
SELECT 
  'Agents with RGA' as metric,
  COUNT(*) as count
FROM agent_hierarchy
WHERE rga_name IS NOT NULL
UNION ALL
SELECT 
  'Agents with both MGA and RGA' as metric,
  COUNT(*) as count
FROM agent_hierarchy
WHERE mga_name IS NOT NULL AND rga_name IS NOT NULL
UNION ALL
SELECT 
  'Agents updated in last 5 minutes' as metric,
  COUNT(*) as count
FROM agent_hierarchy
WHERE updated_at > NOW() - INTERVAL '5 minutes';
