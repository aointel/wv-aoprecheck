-- Check Patricia's states and market configuration
SELECT 
  company_email,
  states,
  market,
  associate_id,
  first_name,
  last_name,
  active
FROM customers
WHERE company_email = 'patriciasantamarina@aoglobelife.com'
   OR personal_email = 'patriciasantamarina@aoglobelife.com';

-- Check if there are unassigned Veteran leads in her states
SELECT COUNT(*) as available_veteran_leads
FROM masterlead
WHERE cn_email IS NULL
  AND cnresolution = 'pending'
  AND dnc = false
  AND taalk_market = 'Veteran'
  AND state IS NOT NULL
  AND state != 'DC'
LIMIT 10;

