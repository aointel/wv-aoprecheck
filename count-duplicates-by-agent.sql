-- Count duplicate VDP calls by agent email

SELECT 
  v.agent as associate_id,
  c.company_email,
  c.first_name,
  c.last_name,
  COUNT(*) as total_vdp_entries,
  COUNT(DISTINCT v.leadid) as unique_leads,
  COUNT(*) - COUNT(DISTINCT v.leadid) as duplicate_count
FROM vdp_calls v
LEFT JOIN customers c ON c.associate_id::text = v.agent
WHERE v.updated_at >= CURRENT_DATE
GROUP BY v.agent, c.company_email, c.first_name, c.last_name
HAVING COUNT(*) > COUNT(DISTINCT v.leadid)
ORDER BY duplicate_count DESC;

