-- Reset Patricia's leads back to pending so she can call them again

-- Find Patricia's exact email first
SELECT company_email, first_name, last_name
FROM customers
WHERE LOWER(first_name) LIKE '%patricia%' OR LOWER(company_email) LIKE '%patricia%';

-- Reset "called" leads back to "pending" for Patricia
-- REPLACE 'patriciaXXX@aoglobelife.com' WITH HER ACTUAL EMAIL FROM QUERY ABOVE
UPDATE masterlead
SET 
  cnresolution = 'pending',
  last_contacted = NULL,
  resolution_notes = 'Reset for re-calling',
  updated_at = NOW()
WHERE cn_email = 'REPLACE_WITH_PATRICIA_EMAIL' -- PUT HER REAL EMAIL HERE
  AND cnresolution IN ('called', 'wrong_number')
  AND dnc = false;

-- Check how many were reset
SELECT 
  cnresolution,
  COUNT(*) as count
FROM masterlead
WHERE cn_email = 'REPLACE_WITH_PATRICIA_EMAIL' -- PUT HER REAL EMAIL HERE
GROUP BY cnresolution
ORDER BY count DESC;

