-- Manually insert Anna Perez for Taylor Ermis
-- Run this in Supabase SQL Editor

INSERT INTO recruit_candidates (
  first_name,
  last_name,
  phone,
  email,
  status,
  agent_id,
  agent_email,
  notes,
  created_at,
  updated_at
) VALUES (
  'ANNA',
  'PEREZ',
  '+15036790874',
  '',
  'new',
  '2233111',
  'taylorermis@aoglobelife.com',
  'Manually created from VDP call ID 22831. Associate ID: 2233111, Session: sim-1761078453432',
  NOW(),
  NOW()
)
ON CONFLICT (phone, agent_email) DO UPDATE SET
  updated_at = NOW(),
  notes = recruit_candidates.notes || ' | Updated: ' || NOW()::text;

-- Verify it was created
SELECT * FROM recruit_candidates 
WHERE phone = '+15036790874' 
  OR (agent_id = '2233111' AND first_name = 'ANNA');

