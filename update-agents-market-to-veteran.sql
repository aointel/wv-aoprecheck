-- Update market to "Veteran" for specified agents in customers table
-- This updates both primary_market and market fields
-- Note: market is a JSONB array field, so we need to set it as JSONB

UPDATE customers
SET 
  primary_market = 'Veteran',
  market = '["Veteran"]'::jsonb  -- market is JSONB array, set to array containing "Veteran"
WHERE 
  -- Julia Washington
  (LOWER(first_name) = 'julia' AND LOWER(last_name) = 'washington')
  OR
  -- Heidi Mcmullin
  (LOWER(first_name) = 'heidi' AND LOWER(last_name) = 'mcmullin')
  OR
  -- Laura Miranda
  (LOWER(first_name) = 'laura' AND LOWER(last_name) = 'miranda')
  OR
  -- Tina Dang
  (LOWER(first_name) = 'tina' AND LOWER(last_name) = 'dang')
  OR
  -- Taylor Bass
  (LOWER(first_name) = 'taylor' AND LOWER(last_name) = 'bass')
  OR
  -- Trinh Nguyen (check both name orders)
  (LOWER(first_name) = 'trinh' AND LOWER(last_name) = 'nguyen')
  OR
  (LOWER(first_name) = 'nguyen' AND LOWER(last_name) = 'trinh')
  OR
  -- Jennifer Gallego
  (LOWER(first_name) = 'jennifer' AND LOWER(last_name) = 'gallego')
  OR
  -- Mariah Senter
  (LOWER(first_name) = 'mariah' AND LOWER(last_name) = 'senter')
  OR
  -- Hannah James
  (LOWER(first_name) = 'hannah' AND LOWER(last_name) = 'james')
  OR
  -- Joseph Mitchell
  (LOWER(first_name) = 'joseph' AND LOWER(last_name) = 'mitchell');

-- Verify the updates
SELECT 
  id,
  company_email,
  first_name,
  last_name,
  primary_market,
  market
FROM customers
WHERE 
  (LOWER(first_name) = 'julia' AND LOWER(last_name) = 'washington')
  OR (LOWER(first_name) = 'heidi' AND LOWER(last_name) = 'mcmullin')
  OR (LOWER(first_name) = 'laura' AND LOWER(last_name) = 'miranda')
  OR (LOWER(first_name) = 'tina' AND LOWER(last_name) = 'dang')
  OR (LOWER(first_name) = 'taylor' AND LOWER(last_name) = 'bass')
  OR (LOWER(first_name) = 'trinh' AND LOWER(last_name) = 'nguyen')
  OR (LOWER(first_name) = 'nguyen' AND LOWER(last_name) = 'trinh')
  OR (LOWER(first_name) = 'jennifer' AND LOWER(last_name) = 'gallego')
  OR (LOWER(first_name) = 'mariah' AND LOWER(last_name) = 'senter')
  OR (LOWER(first_name) = 'hannah' AND LOWER(last_name) = 'james')
  OR (LOWER(first_name) = 'joseph' AND LOWER(last_name) = 'mitchell')
ORDER BY first_name, last_name;

