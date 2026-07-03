-- Check if Patricia is properly set up in customers table for auto-refill

SELECT 
  company_email,
  first_name,
  last_name,
  states,
  market,
  associate_id
FROM customers
WHERE company_email = 'patriciasantamarina@aoglobelife.com';

-- If the above returns NULL for states/market, that's why auto-refill isn't working
-- Auto-refill REQUIRES states to be configured

