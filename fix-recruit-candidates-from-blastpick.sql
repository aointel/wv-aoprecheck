-- Create missing recruit candidates from BLAST PICK aorecruit calls
-- This fixes the immediate issue for the 4 candidates that should have been auto-created

-- First, let's see which agents these belong to
SELECT 
  v.agent,
  v."firstName",
  v."lastName", 
  v.phone,
  v.market,
  c.customer_email as agent_email,
  c.first_name as agent_first_name,
  c.last_name as agent_last_name
FROM vdp_calls_BLASTPICK v
LEFT JOIN customers c ON c.associate_id::text = v.agent
WHERE v.market = 'aorecruit'
  AND v.event = 'PICK_UP'
  AND v."firstName" IN ('JOSE', 'Reonard', 'KARTHIK', 'Robert')
ORDER BY v.time DESC;

-- Now insert them into recruit_candidates
-- (Run the SELECT above first to verify the data, then run this INSERT)

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
  v."firstName",
  v."lastName",
  v.phone,
  '', -- email unknown
  'contacted',
  1, -- AO Recruit stage
  v.time::timestamp,
  COALESCE(c.customer_email, 'unknown@aoglobelife.com'),
  COALESCE(c.customer_email, 'unknown@aoglobelife.com'),
  'Auto-created from BLAST PICK call on ' || v.time::date || ' (Agent ID: ' || v.agent || ', Market: ' || v.market || ')',
  v.time::timestamp,
  v.time::timestamp
FROM vdp_calls_BLASTPICK v
LEFT JOIN customers c ON c.associate_id::text = v.agent
WHERE v.market = 'aorecruit'
  AND v.event = 'PICK_UP'
  AND v."firstName" IN ('JOSE', 'Reonard', 'KARTHIK', 'Robert')
  AND NOT EXISTS (
    SELECT 1 FROM recruit_candidates rc
    WHERE rc.phone = v.phone
  )
ORDER BY v.time DESC
RETURNING *;

-- Verify the candidates were created
SELECT 
  rc.id,
  rc.first_name,
  rc.last_name,
  rc.phone,
  rc.status,
  rc.agent_email,
  rc.created_at,
  rc.notes
FROM recruit_candidates rc
WHERE rc.first_name IN ('JOSE', 'Reonard', 'KARTHIK', 'Robert', 'jose', 'reonard', 'karthik', 'robert')
ORDER BY rc.created_at DESC;

