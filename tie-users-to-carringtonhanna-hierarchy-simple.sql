-- ============================================================================
-- Tie Users to Carrington Hanna in agent_hierarchy
-- ============================================================================
-- This script ensures the specified users are tied to Carrington Hanna
-- as their MGA in the agent_hierarchy table
-- ============================================================================

-- Get Carrington Hanna's associate_id
WITH carrington_info AS (
  SELECT associate_id, first_name || ' ' || last_name as name
  FROM customers
  WHERE company_email = 'carringtonhanna@aoglobelife.com'
     OR personal_email = 'carringtonhanna@aoglobelife.com'
  LIMIT 1
)
-- Update/Insert each user
UPDATE agent_hierarchy ah
SET 
  mga_name = ci.name,
  mga_associate_id = ci.associate_id,
  updated_at = NOW()
FROM carrington_info ci
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
);

-- Insert any missing users
WITH carrington_info AS (
  SELECT associate_id, first_name || ' ' || last_name as name
  FROM customers
  WHERE company_email = 'carringtonhanna@aoglobelife.com'
     OR personal_email = 'carringtonhanna@aoglobelife.com'
  LIMIT 1
),
agent_data AS (
  SELECT 
    c.associate_id as agent_associate_id,
    LOWER(c.company_email) as agent_email,
    COALESCE(ap.first_name || ' ' || ap.last_name, c.company_email) as agent_name
  FROM customers c
  LEFT JOIN agent_profiles ap ON ap.email = LOWER(c.company_email)
  WHERE LOWER(c.company_email) IN (
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
  AND c.associate_id IS NOT NULL
)
INSERT INTO agent_hierarchy (
  agent_associate_id,
  agent_email,
  agent_name,
  mga_name,
  mga_associate_id,
  updated_at
)
SELECT 
  ad.agent_associate_id,
  ad.agent_email,
  ad.agent_name,
  ci.name,
  ci.associate_id,
  NOW()
FROM agent_data ad
CROSS JOIN carrington_info ci
WHERE NOT EXISTS (
  SELECT 1 FROM agent_hierarchy ah 
  WHERE ah.agent_associate_id = ad.agent_associate_id
)
ON CONFLICT (agent_associate_id) 
DO UPDATE SET
  agent_email = EXCLUDED.agent_email,
  agent_name = EXCLUDED.agent_name,
  mga_name = EXCLUDED.mga_name,
  mga_associate_id = EXCLUDED.mga_associate_id,
  updated_at = NOW();

-- Verification query
SELECT 
  agent_email,
  agent_name,
  agent_associate_id,
  mga_name,
  mga_associate_id,
  rga_name,
  rga_associate_id,
  updated_at
FROM agent_hierarchy
WHERE agent_email IN (
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
ORDER BY agent_email;

