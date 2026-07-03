-- Set trialone flag based on ccpro_enabled status
-- If ccpro_enabled = false → trialone = true (pre-trial, 50 leads)
-- If ccpro_enabled = true → trialone = false (pro, unlimited leads)

UPDATE agent_live_call_status
SET trialone = CASE 
  WHEN ccpro_enabled = false THEN true
  WHEN ccpro_enabled = true THEN false
  ELSE false  -- Default to false if null
END;

-- Show summary
SELECT 
  'Trial Users (trialone=true)' as status,
  COUNT(*) as count
FROM agent_live_call_status
WHERE trialone = true

UNION ALL

SELECT 
  'Pro Users (trialone=false)' as status,
  COUNT(*) as count
FROM agent_live_call_status
WHERE trialone = false;

-- Show detailed breakdown
SELECT 
  agent_email,
  ccpro_enabled,
  trialone,
  status,
  CASE 
    WHEN ccpro_enabled = false AND trialone = true THEN '✅ Correct (Trial)'
    WHEN ccpro_enabled = true AND trialone = false THEN '✅ Correct (Pro)'
    ELSE '❌ Mismatch'
  END as check_status
FROM agent_live_call_status
ORDER BY agent_email;

