-- Check if there are unassigned leads available for auto-refill

-- Total unassigned leads with resolution pending or null
SELECT 
  COUNT(*) as total_unassigned,
  COUNT(*) FILTER (WHERE cnresolution = 'pending') as pending_count,
  COUNT(*) FILTER (WHERE cnresolution IS NULL) as null_resolution_count,
  COUNT(*) FILTER (WHERE cnresolution = 'called') as called_count
FROM masterlead
WHERE (cn_email IS NULL OR cn_email = '')
  AND dnc = false
  AND (state != 'DC' AND taalk_state != 'DC')
  AND (cnresolution IS NULL OR cnresolution = 'pending' OR cnresolution = 'called');

-- Check by market (Veteran)
SELECT 
  taalk_market,
  COUNT(*) as unassigned_count
FROM masterlead
WHERE (cn_email IS NULL OR cn_email = '')
  AND dnc = false
  AND (state != 'DC' AND taalk_state != 'DC')
  AND (cnresolution IS NULL OR cnresolution = 'pending' OR cnresolution = 'called')
GROUP BY taalk_market
ORDER BY unassigned_count DESC;

-- Check by state (top 20 states)
SELECT 
  COALESCE(state, taalk_state) as state,
  COUNT(*) as unassigned_count
FROM masterlead
WHERE (cn_email IS NULL OR cn_email = '')
  AND dnc = false
  AND (state != 'DC' AND taalk_state != 'DC')
  AND (cnresolution IS NULL OR cnresolution = 'pending' OR cnresolution = 'called')
GROUP BY COALESCE(state, taalk_state)
ORDER BY unassigned_count DESC
LIMIT 20;

