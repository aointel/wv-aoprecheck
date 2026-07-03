-- Insert one recruit_candidate from vdp_calls_BLASTPICK when the poller didn't run.
-- Example: Jacqueline Sexton, BLASTPICK id 184926, agent 12356789.
-- Run in Supabase SQL editor. Resolves agent_email from producerlist / agent_hierarchy / customers.

WITH agent AS (
  SELECT COALESCE(
    (SELECT company_email FROM producerlist WHERE associate_id = 12356789 LIMIT 1),
    (SELECT agent_email FROM agent_hierarchy WHERE agent_associate_id = 12356789 LIMIT 1),
    (SELECT email FROM agent_profiles WHERE agent_id = '12356789' LIMIT 1),
    (SELECT COALESCE(company_email, personal_email) FROM customers WHERE associate_id = 12356789 LIMIT 1),
    'unknown-agent-12356789@aoglobelife.com'
  ) AS email
)
INSERT INTO recruit_candidates (
  first_name, last_name, phone, email, status, agent_id, agent_email, notes, created_at, updated_at
)
SELECT
  'Jacqueline',
  'Sexton',
  '+18065665206',
  '',
  'contacted',
  '12356789',
  agent.email,
  'Inserted from vdp_calls_BLASTPICK id=184926 (poller was disabled). Session: 69b30356fb93ec14e6074552',
  '2026-03-12 18:20:13.661+00'::timestamptz,
  NOW()
FROM agent
WHERE NOT EXISTS (
  SELECT 1 FROM recruit_candidates
  WHERE phone = '+18065665206'
  AND agent_email = (SELECT email FROM agent)
);
