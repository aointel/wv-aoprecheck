-- Check what columns actually exist in producerlist
SELECT * FROM producerlist LIMIT 1;

-- Check if these agents exist
SELECT 
  associate_id,
  company_email,
  agent_name,
  mga,
  rga
FROM producerlist
WHERE associate_id IN (63603, 409, 78434)
ORDER BY associate_id;

