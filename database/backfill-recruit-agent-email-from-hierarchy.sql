-- Fix recruit_candidates that have agent_email = 'unknown-agent-XXXXX@aoglobelife.com'
-- by setting agent_email (and agent_id) from producerlist or agent_hierarchy.
-- Run in Supabase SQL editor after associate IDs are in producerlist/agent_hierarchy.

-- Option A: From producerlist (associate_id -> company_email)
UPDATE recruit_candidates c
SET
  agent_email = p.company_email,
  agent_id = COALESCE(c.agent_id, p.associate_id::text),
  updated_at = now()
FROM (
  SELECT associate_id, company_email
  FROM producerlist
  WHERE company_email IS NOT NULL AND company_email != ''
) p
WHERE c.agent_email LIKE 'unknown-agent-%@aoglobelife.com'
  AND TRIM(REPLACE(REPLACE(c.agent_email, 'unknown-agent-', ''), '@aoglobelife.com', '')) = p.associate_id::text;

-- Option B: From agent_hierarchy (agent_associate_id -> agent_email) for any still unknown
UPDATE recruit_candidates c
SET
  agent_email = h.agent_email,
  agent_id = COALESCE(c.agent_id, h.agent_associate_id::text),
  updated_at = now()
FROM (
  SELECT agent_associate_id, agent_email
  FROM agent_hierarchy
  WHERE agent_email IS NOT NULL AND agent_email != ''
) h
WHERE c.agent_email LIKE 'unknown-agent-%@aoglobelife.com'
  AND TRIM(REPLACE(REPLACE(c.agent_email, 'unknown-agent-', ''), '@aoglobelife.com', '')) = h.agent_associate_id::text;
