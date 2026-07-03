-- Check if unassigned leads have taalk_market = 'Veteran'

SELECT 
  taalk_market,
  COUNT(*) as count
FROM masterlead
WHERE (cn_email IS NULL OR cn_email = '')
  AND dnc = false
  AND (cnresolution IS NULL OR cnresolution = 'pending' OR cnresolution = 'called')
GROUP BY taalk_market
ORDER BY count DESC;

-- Check if NJ unassigned leads are Veteran market
SELECT 
  COUNT(*) as nj_veteran_unassigned
FROM masterlead
WHERE (cn_email IS NULL OR cn_email = '')
  AND dnc = false
  AND (state = 'NJ' OR taalk_state = 'NJ')
  AND taalk_market = 'Veteran'
  AND (cnresolution IS NULL OR cnresolution = 'pending' OR cnresolution = 'called');

