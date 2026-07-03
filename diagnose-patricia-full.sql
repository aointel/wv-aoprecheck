-- Full diagnosis for Patricia Santamarina lead loading issue

-- Step 1: Check Patricia's customer record
SELECT 
  'CUSTOMER RECORD' as check_type,
  company_email,
  CCPRO,
  states,
  market,
  PLUSACTIVE
FROM customers
WHERE company_email = 'patriciasantamarina@aoglobelife.com';

-- Step 2: Count her current pending leads
SELECT 
  'CURRENT LEADS' as check_type,
  COUNT(*) as count
FROM masterlead
WHERE cn_email = 'patriciasantamarina@aoglobelife.com'
  AND cnresolution = 'pending';

-- Step 3: Count available Veteran leads in her states
SELECT 
  'AVAILABLE LEADS' as check_type,
  COUNT(*) as count
FROM masterlead
WHERE cn_email IS NULL
  AND cnresolution = 'pending'
  AND dnc = false
  AND taalk_market = 'Veteran'
  AND state IN ('AK', 'AL', 'AR', 'AZ', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA');

-- Step 4: Sample of available leads
SELECT 
  'SAMPLE AVAILABLE' as check_type,
  id,
  first_name,
  last_name,
  state,
  taalk_market,
  cnresolution
FROM masterlead
WHERE cn_email IS NULL
  AND cnresolution = 'pending'
  AND dnc = false
  AND taalk_market = 'Veteran'
  AND state IN ('AK', 'AL', 'AR', 'AZ', 'CA')
LIMIT 5;

