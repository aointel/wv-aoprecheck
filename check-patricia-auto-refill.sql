-- Check why Patricia isn't getting auto-refilled with leads

-- 1. Get Patricia's email and states from customers table
SELECT 
  company_email,
  first_name,
  last_name,
  states,
  market
FROM customers
WHERE LOWER(first_name) LIKE '%patricia%' OR LOWER(company_email) LIKE '%patricia%';

-- 2. Check if there are available unassigned leads in her states/market
-- This checks if there ARE leads to assign
SELECT 
  state,
  COUNT(*) as available_leads
FROM masterlead
WHERE cnresolution = 'pending'
  AND (cn_email IS NULL OR cn_email = '')
  AND dnc = false
GROUP BY state
ORDER BY available_leads DESC
LIMIT 20;

-- 3. Total unassigned pending leads
SELECT COUNT(*) as total_unassigned_pending
FROM masterlead
WHERE cnresolution = 'pending'
  AND (cn_email IS NULL OR cn_email = '')
  AND dnc = false;

