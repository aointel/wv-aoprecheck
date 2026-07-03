-- Check if Patricia Santamarina exists in customers table
SELECT 
  id,
  company_email,
  personal_email,
  associate_id,
  states,
  market,
  first_name,
  last_name
FROM customers
WHERE company_email = 'patriciasantamarina@aoglobelife.com'
   OR personal_email = 'patriciasantamarina@aoglobelife.com';

-- If she's not there, check what columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'customers'
ORDER BY ordinal_position;

