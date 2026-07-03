-- Check if VDP calls (connects) are being tracked for today

-- 1. Check if vdp_calls table has any data
SELECT 
  'Total VDP Calls' as info,
  COUNT(*) as count
FROM vdp_calls;

-- 2. Check today's VDP calls
SELECT 
  'Today VDP Calls' as info,
  COUNT(*) as count
FROM vdp_calls
WHERE updated_at >= CURRENT_DATE;

-- 3. Show recent VDP calls with agent emails
SELECT 
  *
FROM vdp_calls
WHERE updated_at >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY updated_at DESC
LIMIT 20;

-- 4. Count VDP calls by agent for today
SELECT 
  company_email,
  COUNT(*) as connects_today
FROM vdp_calls
WHERE updated_at >= CURRENT_DATE
GROUP BY company_email
ORDER BY connects_today DESC;

-- 5. Check if Carrington's agents have any VDP calls today
SELECT 
  v.company_email,
  COUNT(*) as connects
FROM vdp_calls v
JOIN agent_hierarchy ah ON LOWER(TRIM(v.company_email)) = LOWER(TRIM(ah.agent_email))
WHERE ah.mga_associate_id = 91167  -- Carrington's MGA ID
  AND v.updated_at >= CURRENT_DATE
GROUP BY v.company_email;

