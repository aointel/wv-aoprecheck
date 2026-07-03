-- Complete fix for Leyna's account
-- Run this in Supabase SQL Editor

-- 1. Fix producers table - set proper markets
UPDATE producers 
SET markets = ARRAY['CA', 'TX', 'FL', 'NY', 'IL', 'PA', 'OH', 'MI', 'GA', 'NC']::text[]
WHERE email = 'leynatran@aoglobelife.com';

-- 2. Delete duplicate producer record (keep the one with data)
DELETE FROM producers 
WHERE email = 'leynatran@aoglobelife.com' 
  AND markets IS NULL 
  AND id NOT IN (
    SELECT MIN(id) FROM producers WHERE email = 'leynatran@aoglobelife.com'
  );

-- 3. Fix customers table - enable CCPRO
UPDATE customers 
SET "CCPRO" = true
WHERE company_email = 'leynatran@aoglobelife.com';

-- 4. Verify the fixes
SELECT 'producers check' as table_name, email, markets, id 
FROM producers 
WHERE email = 'leynatran@aoglobelife.com'
UNION ALL
SELECT 'customers check', company_email, "CCPRO"::text[], id::integer
FROM customers 
WHERE company_email = 'leynatran@aoglobelife.com';

