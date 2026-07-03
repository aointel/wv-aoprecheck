-- Check if Leonard Childress exists in any tables and find the VDP webhook data

-- Check VDP webhook events for Leonard
SELECT 
  id,
  event_type,
  event_date,
  event_time,
  phone_number,
  agent_id,
  leadid,
  raw_webhook_data,
  created_at
FROM vdp_webhook_events
WHERE raw_webhook_data::text ILIKE '%childress%'
   OR raw_webhook_data::text ILIKE '%leonard%'
ORDER BY created_at DESC
LIMIT 10;

-- Check if candidate already exists
SELECT *
FROM recruit_candidates
WHERE first_name ILIKE '%leonard%'
   OR last_name ILIKE '%childress%'
   OR phone ILIKE '%childress%'
ORDER BY created_at DESC;

-- Check VDP connects table
SELECT *
FROM vdp_connects
WHERE client_name ILIKE '%childress%'
   OR client_name ILIKE '%leonard%'
ORDER BY connect_date DESC
LIMIT 10;

-- If we find the webhook data, manually create the candidate:
-- (Replace with actual data from the webhook query above)
/*
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
) VALUES (
  'Leonard',
  'Childress',
  'PHONE_FROM_WEBHOOK',  -- Replace with actual phone
  '',
  'contacted',
  1,  -- AO Recruit stage
  NOW(),
  'AGENT_EMAIL_FROM_WEBHOOK',  -- Replace with actual agent email
  'AGENT_EMAIL_FROM_WEBHOOK',  -- Replace with actual agent email
  'Manually created from VDP webhook data',
  NOW(),
  NOW()
) RETURNING *;
*/

