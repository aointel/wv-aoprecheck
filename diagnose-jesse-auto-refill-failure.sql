-- DIAGNOSE: Why Jesse Russo wasn't auto-refilled when he dropped below 10 leads

-- Step 1: Current state - how many pending leads does Jesse have?
SELECT 
  'Jesse Current Pending Leads' as info,
  COUNT(*) as pending_count
FROM masterlead
WHERE cn_email = 'jesserusso@aoglobelife.com'
  AND cnresolution = 'pending';

-- Step 2: Is Jesse in the customers table with states/market configured?
SELECT 
  'Jesse Customer Config' as info,
  company_email,
  first_name,
  last_name,
  states,
  market,
  associate_id,
  CASE 
    WHEN states IS NULL THEN '❌ NO STATES - AUTO-REFILL WILL SKIP'
    WHEN states::text = '[]' THEN '❌ EMPTY STATES ARRAY - AUTO-REFILL WILL SKIP'
    WHEN market IS NULL THEN '⚠️ NO MARKET - WILL DEFAULT TO VETERAN'
    ELSE '✅ CONFIGURED'
  END as auto_refill_status
FROM customers
WHERE company_email = 'jesserusso@aoglobelife.com';

-- Step 3: Check if there are unassigned leads matching Jesse's market (if he has one configured)
-- First, get his market
WITH jesse_market AS (
  SELECT 
    CASE 
      WHEN market IS NULL THEN 'Veteran'
      WHEN market::text LIKE '[%' THEN (market::jsonb->>0)::text
      ELSE market::text
    END as market_value
  FROM customers
  WHERE company_email = 'jesserusso@aoglobelife.com'
)
SELECT 
  'Available unassigned leads for Jesse market' as info,
  jm.market_value as jesse_market,
  COUNT(*) as available_unassigned
FROM masterlead m
CROSS JOIN jesse_market jm
WHERE (m.cn_email IS NULL OR m.cn_email = '')
  AND m.dnc = false
  AND (m.cnresolution IS NULL OR m.cnresolution = 'pending' OR m.cnresolution = 'called')
  AND m.taalk_market = jm.market_value
GROUP BY jm.market_value;

-- Step 4: Total leads Jesse has ever been assigned
SELECT 
  'Jesse Total Leads' as info,
  COUNT(*) as total_leads,
  COUNT(*) FILTER (WHERE cnresolution = 'pending') as pending,
  COUNT(*) FILTER (WHERE cnresolution = 'called') as called,
  COUNT(*) FILTER (WHERE cnresolution = 'booked') as booked,
  COUNT(*) FILTER (WHERE cnresolution = 'wrong_number') as wrong_number
FROM masterlead
WHERE cn_email = 'jesserusso@aoglobelife.com';

