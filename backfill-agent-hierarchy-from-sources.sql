-- Backfill missing agents in agent_hierarchy from multiple sources
-- This script adds agents that exist in other tables but are missing from agent_hierarchy
--
-- IMPORTANT: Run this script in Supabase SQL Editor to backfill missing agents
-- The script will:
-- 1. Add agents from customers table first (primary source)
-- 2. Add agents from producerlist (with mga/rga data, secondary source)
-- 3. Add agents from live_call_boardt (active agents, only if associate_id found)
-- 4. Update existing records with missing hierarchy data
-- 5. Update missing names/emails from producerlist
--
-- Note: agent_hierarchy has UNIQUE constraint on agent_associate_id (NOT NULL)
-- Agents without associate_id cannot be inserted (schema limitation)

-- Step 1: Add agents from customers table first (primary source)
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

-- Step 2: Add agents from producerlist table (has mga/rga columns, secondary source)
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
ON CONFLICT (agent_associate_id) DO NOTHING;

-- Step 3: Add agents from live_call_boardt (by email match)
-- Try to find associate_id from customers first, then producerlist
-- NOTE: agent_associate_id is NOT NULL, so we can only insert if we find an associate_id
INSERT INTO agent_hierarchy (
  agent_associate_id,
  agent_email,
  agent_name,
  created_at,
  updated_at
)
SELECT DISTINCT
  COALESCE(
    (SELECT associate_id FROM customers WHERE LOWER(TRIM(company_email)) = LOWER(TRIM(lcb.agent_email)) OR LOWER(TRIM(personal_email)) = LOWER(TRIM(lcb.agent_email)) LIMIT 1),
    (SELECT associate_id FROM producerlist WHERE LOWER(TRIM(company_email)) = LOWER(TRIM(lcb.agent_email)) LIMIT 1)
  ) as agent_associate_id,
  LOWER(TRIM(lcb.agent_email)) as agent_email,
  COALESCE(lcb.agent_name, SPLIT_PART(lcb.agent_email, '@', 1)) as agent_name,
  NOW() as created_at,
  NOW() as updated_at
FROM live_call_boardt lcb
WHERE lcb.agent_email IS NOT NULL
  AND LOWER(TRIM(lcb.agent_email)) LIKE '%@aoglobelife.com'
  -- Only insert if we found an associate_id (required - agent_associate_id is NOT NULL)
  AND COALESCE(
    (SELECT associate_id FROM customers WHERE LOWER(TRIM(company_email)) = LOWER(TRIM(lcb.agent_email)) OR LOWER(TRIM(personal_email)) = LOWER(TRIM(lcb.agent_email)) LIMIT 1),
    (SELECT associate_id FROM producerlist WHERE LOWER(TRIM(company_email)) = LOWER(TRIM(lcb.agent_email)) LIMIT 1)
  ) IS NOT NULL
  -- Only insert if agent doesn't already exist in agent_hierarchy (by email or associate_id)
  AND NOT EXISTS (
    SELECT 1 FROM agent_hierarchy ah 
    WHERE LOWER(TRIM(ah.agent_email)) = LOWER(TRIM(lcb.agent_email))
       OR (ah.agent_associate_id IS NOT NULL 
           AND ah.agent_associate_id = COALESCE(
             (SELECT associate_id FROM customers WHERE LOWER(TRIM(company_email)) = LOWER(TRIM(lcb.agent_email)) OR LOWER(TRIM(personal_email)) = LOWER(TRIM(lcb.agent_email)) LIMIT 1),
             (SELECT associate_id FROM producerlist WHERE LOWER(TRIM(company_email)) = LOWER(TRIM(lcb.agent_email)) LIMIT 1)
           ))
  )
ON CONFLICT (agent_associate_id) DO NOTHING;

-- Step 4: Update existing agent_hierarchy records with missing hierarchy data from producerlist
UPDATE agent_hierarchy ah
SET
  mga_name = COALESCE(ah.mga_name, p.mga),
  rga_name = COALESCE(ah.rga_name, p.rga),
  mga_associate_id = COALESCE(ah.mga_associate_id, 
    (SELECT associate_id FROM producerlist WHERE LOWER(TRIM(agent_name)) = LOWER(TRIM(p.mga)) OR LOWER(TRIM(name)) = LOWER(TRIM(p.mga)) LIMIT 1)
  ),
  rga_associate_id = COALESCE(ah.rga_associate_id,
    (SELECT associate_id FROM producerlist WHERE LOWER(TRIM(agent_name)) = LOWER(TRIM(p.rga)) OR LOWER(TRIM(name)) = LOWER(TRIM(p.rga)) LIMIT 1)
  ),
  updated_at = NOW()
FROM producerlist p
WHERE (ah.agent_associate_id = p.associate_id OR LOWER(TRIM(ah.agent_email)) = LOWER(TRIM(p.company_email)))
  AND (ah.mga_name IS NULL OR ah.rga_name IS NULL)
  AND (p.mga IS NOT NULL OR p.rga IS NOT NULL);

-- Step 5: Update agent names and emails from producerlist if they're missing
UPDATE agent_hierarchy ah
SET
  agent_name = COALESCE(ah.agent_name, p.agent_name, p.name),
  agent_email = COALESCE(ah.agent_email, LOWER(TRIM(p.company_email))),
  updated_at = NOW()
FROM producerlist p
WHERE (ah.agent_associate_id = p.associate_id OR LOWER(TRIM(ah.agent_email)) = LOWER(TRIM(p.company_email)))
  AND (ah.agent_name IS NULL OR ah.agent_email IS NULL);

-- Summary query to see what was added/updated
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
  'Agents with associate_id' as metric,
  COUNT(*) as count
FROM agent_hierarchy
WHERE agent_associate_id IS NOT NULL
UNION ALL
SELECT 
  'Agents with email' as metric,
  COUNT(*) as count
FROM agent_hierarchy
WHERE agent_email IS NOT NULL;
