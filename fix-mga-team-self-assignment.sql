-- FIX: Remove self-assigned MGA teams where agent_mga_team = agent's own name
-- This corrects the bad data created by the self-assignment logic

-- First, let's see how many sessions have this problem
SELECT COUNT(*) as bad_mga_assignments
FROM verification_sessions
WHERE agent_mga_team IS NOT NULL
  AND agent_first_name IS NOT NULL
  AND agent_last_name IS NOT NULL
  AND UPPER(agent_mga_team) = UPPER(agent_first_name || ' ' || agent_last_name);

-- Now fix them by looking up the CORRECT MGA team from agent_hierarchy
UPDATE verification_sessions v
SET agent_mga_team = h.mga_name,
    agent_rga_team = h.rga_name,
    updated_at = NOW()
FROM agent_hierarchy h
WHERE v.associate_id = h.agent_associate_id
  AND v.agent_mga_team IS NOT NULL
  AND v.agent_first_name IS NOT NULL
  AND v.agent_last_name IS NOT NULL
  AND UPPER(v.agent_mga_team) = UPPER(v.agent_first_name || ' ' || v.agent_last_name)
  AND h.mga_name IS NOT NULL
  AND h.mga_name != '0';

-- For sessions where we can't find in agent_hierarchy by associate_id, try by email
UPDATE verification_sessions v
SET agent_mga_team = h.mga_name,
    agent_rga_team = h.rga_name,
    updated_at = NOW()
FROM agent_hierarchy h
WHERE v.company_email = h.agent_email
  AND v.agent_mga_team IS NOT NULL
  AND v.agent_first_name IS NOT NULL
  AND v.agent_last_name IS NOT NULL
  AND UPPER(v.agent_mga_team) = UPPER(v.agent_first_name || ' ' || v.agent_last_name)
  AND h.mga_name IS NOT NULL
  AND h.mga_name != '0';

-- Set to NULL for any remaining self-assigned teams that can't be fixed
UPDATE verification_sessions
SET agent_mga_team = NULL,
    updated_at = NOW()
WHERE agent_mga_team IS NOT NULL
  AND agent_first_name IS NOT NULL
  AND agent_last_name IS NOT NULL
  AND UPPER(agent_mga_team) = UPPER(agent_first_name || ' ' || agent_last_name);

-- Show the fixed sessions
SELECT 
  id,
  session_id,
  agent_first_name || ' ' || agent_last_name as agent_name,
  agent_mga_team,
  agent_rga_team,
  company_email,
  status,
  created_at
FROM verification_sessions
WHERE updated_at > NOW() - INTERVAL '1 minute'
ORDER BY updated_at DESC
LIMIT 50;




