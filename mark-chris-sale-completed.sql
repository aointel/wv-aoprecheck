-- Mark Chris LaFond's verification session as COMPLETED so it counts as a sale

UPDATE verification_sessions
SET 
  status = 'completed',
  completed_at = COALESCE(completed_at, created_at + INTERVAL '5 minutes'),
  verification_result = 'COMPLETED'
WHERE first_name = 'AMY'
  AND last_name = 'NORDSTROM'
  AND phone = '8017258876'
  AND company_email = 'chrislafond@aoglobelife.com'
  AND created_at::date = '2025-10-26';

-- Verify the update
SELECT 
  session_id,
  first_name,
  last_name,
  phone,
  premium,
  status,
  verification_result,
  created_at,
  completed_at,
  company_email
FROM verification_sessions
WHERE first_name = 'AMY'
  AND last_name = 'NORDSTROM'
  AND phone = '8017258876'
  AND company_email = 'chrislafond@aoglobelife.com';

-- Check Chris's stats
SELECT 
  company_email as agent_email,
  COUNT(*) as total_verifications,
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_sales,
  SUM(CASE WHEN status = 'completed' THEN CAST(REPLACE(premium, '$', '') AS DECIMAL) * 12 ELSE 0 END) as total_alp
FROM verification_sessions
WHERE company_email = 'chrislafond@aoglobelife.com'
  AND created_at::date = '2025-10-26'
GROUP BY company_email;

