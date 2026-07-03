-- Check who agent 78434 is
SELECT 
  associate_id,
  company_email,
  agent_name,
  mga,
  rga
FROM producerlist
WHERE associate_id = 78434;

-- Find Rochelle in producerlist
SELECT 
  associate_id,
  company_email,
  agent_name,
  mga,
  rga
FROM producerlist
WHERE agent_name ILIKE '%rochelle%'
   OR company_email ILIKE '%rochelle%';

-- Check recent aorecruit calls
SELECT 
  id,
  time,
  agent,
  firstName,
  lastName,
  phone,
  market
FROM vdp_calls_BLASTPICK
WHERE market = 'aorecruit'
ORDER BY time DESC
LIMIT 10;

