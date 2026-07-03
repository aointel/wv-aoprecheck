-- Count duplicate VDP calls by agent email
-- Duplicates = same leadid appearing multiple times

SELECT 
  v.company_email,
  COUNT(*) as duplicate_entries,
  COUNT(DISTINCT v.leadid) as unique_leads_with_duplicates
FROM vdp_calls v
WHERE v.updated_at >= CURRENT_DATE
  AND v.leadid IN (
    -- Find leadids that appear multiple times (duplicates)
    SELECT leadid
    FROM vdp_calls
    WHERE updated_at >= CURRENT_DATE
    GROUP BY leadid
    HAVING COUNT(*) > 1
  )
GROUP BY v.company_email
ORDER BY duplicate_entries DESC;

