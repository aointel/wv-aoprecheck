-- Check Patricia's leads in Call Connector Pro

-- 1. Find Patricia's email
SELECT 
  company_email,
  first_name,
  last_name,
  associate_id
FROM customers
WHERE LOWER(first_name) LIKE '%patricia%'
   OR LOWER(last_name) LIKE '%patricia%'
   OR LOWER(company_email) LIKE '%patricia%';

-- 2. Check if Patricia has pending leads
SELECT 
  cn_email,
  cnresolution,
  COUNT(*) as lead_count
FROM masterlead
WHERE LOWER(cn_email) LIKE '%patricia%'
GROUP BY cn_email, cnresolution
ORDER BY lead_count DESC;

-- 3. Check Patricia's pending leads details
SELECT 
  id,
  first_name,
  last_name,
  phone,
  state,
  cnresolution,
  dnc,
  last_contacted,
  created_at
FROM masterlead
WHERE LOWER(cn_email) LIKE '%patricia%'
  AND cnresolution = 'pending'
ORDER BY created_at DESC
LIMIT 20;

-- 4. Count total leads by resolution
SELECT 
  cnresolution,
  COUNT(*) as count
FROM masterlead
WHERE LOWER(cn_email) LIKE '%patricia%'
GROUP BY cnresolution
ORDER BY count DESC;

