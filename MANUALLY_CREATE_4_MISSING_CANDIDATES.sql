-- EMERGENCY FIX: Manually create the 4 missing recruit candidates
-- These should have been auto-created by the poller but agent emails might be missing

-- Now create the 4 missing candidates
-- We'll use the agent's Associate ID and look up their email from producerlist

-- 1. JOSE VILLEGAS - Agent 63603 - Phone +13133307063
INSERT INTO recruit_candidates (
  first_name,
  last_name,
  phone,
  email,
  status,
  current_stage_id,
  stage_entered_at,
  agent_id,
  agent_email,
  notes,
  created_at,
  updated_at
)
SELECT 
  'JOSE',
  'VILLEGAS',
  '+13133307063',
  '',
  'contacted',
  1,
  '2025-10-27 13:45:20.692+00'::timestamp,
  '63603',
  COALESCE(p.company_email, 'unknown@aoglobelife.com'),
  'Auto-created from BLAST PICK call on 2025-10-27 (Agent ID: 63603, Market: aorecruit)',
  '2025-10-27 13:45:20.692+00'::timestamp,
  NOW()
FROM producerlist p
WHERE p.associate_id = 63603
LIMIT 1
RETURNING *;

-- 2. Reonard Childress - Agent 409 - Phone +18702537320
INSERT INTO recruit_candidates (
  first_name,
  last_name,
  phone,
  email,
  status,
  current_stage_id,
  stage_entered_at,
  agent_id,
  agent_email,
  notes,
  created_at,
  updated_at
)
SELECT 
  'Reonard',
  'Childress',
  '+18702537320',
  '',
  'contacted',
  1,
  '2025-10-27 13:45:08.131+00'::timestamp,
  '409',
  COALESCE(p.company_email, 'unknown@aoglobelife.com'),
  'Auto-created from BLAST PICK call on 2025-10-27 (Agent ID: 409, Market: aorecruit)',
  '2025-10-27 13:45:08.131+00'::timestamp,
  NOW()
FROM producerlist p
WHERE p.associate_id = 409
LIMIT 1
RETURNING *;

-- 3. KARTHIK SUBRAMANI - Agent 78434 - Phone +19472058048
INSERT INTO recruit_candidates (
  first_name,
  last_name,
  phone,
  email,
  status,
  current_stage_id,
  stage_entered_at,
  agent_id,
  agent_email,
  notes,
  created_at,
  updated_at
)
SELECT 
  'KARTHIK',
  'SUBRAMANI',
  '+19472058048',
  '',
  'contacted',
  1,
  '2025-10-27 13:43:46.766+00'::timestamp,
  '78434',
  COALESCE(p.company_email, 'unknown@aoglobelife.com'),
  'Auto-created from BLAST PICK call on 2025-10-27 (Agent ID: 78434, Market: aorecruit)',
  '2025-10-27 13:43:46.766+00'::timestamp,
  NOW()
FROM producerlist p
WHERE p.associate_id = 78434
LIMIT 1
RETURNING *;

-- 4. Robert Juray - Agent 63603 - Phone +18645868416
INSERT INTO recruit_candidates (
  first_name,
  last_name,
  phone,
  email,
  status,
  current_stage_id,
  stage_entered_at,
  agent_id,
  agent_email,
  notes,
  created_at,
  updated_at
)
SELECT 
  'Robert',
  'Juray',
  '+18645868416',
  '',
  'contacted',
  1,
  '2025-10-27 13:43:21.813+00'::timestamp,
  '63603',
  COALESCE(p.company_email, 'unknown@aoglobelife.com'),
  'Auto-created from BLAST PICK call on 2025-10-27 (Agent ID: 63603, Market: aorecruit)',
  '2025-10-27 13:43:21.813+00'::timestamp,
  NOW()
FROM producerlist p
WHERE p.associate_id = 63603
LIMIT 1
RETURNING *;

-- Verify all 4 candidates were created
SELECT 
  id,
  first_name,
  last_name,
  phone,
  status,
  agent_id,
  agent_email,
  created_at,
  notes
FROM recruit_candidates
WHERE phone IN ('+13133307063', '+18702537320', '+19472058048', '+18645868416')
ORDER BY created_at DESC;

