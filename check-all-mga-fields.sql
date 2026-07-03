-- Check ALL columns in verification_sessions table that might contain MGA data
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'verification_sessions'
  AND (column_name ILIKE '%mga%' 
    OR column_name ILIKE '%rga%' 
    OR column_name ILIKE '%team%'
    OR column_name ILIKE '%manager%')
ORDER BY ordinal_position;

-- Check a specific recent session to see ALL team-related fields
SELECT 
  id,
  session_id,
  agent_first_name || ' ' || agent_last_name as agent_name,
  agent_email,
  company_email,
  associate_id,
  agent_mga_team,
  agent_rga_team
FROM verification_sessions
WHERE created_at >= CURRENT_DATE - INTERVAL '1 day'
ORDER BY created_at DESC
LIMIT 5;




