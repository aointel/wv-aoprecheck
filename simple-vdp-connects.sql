-- Simple: Count VDP calls (connects) for today
SELECT 
  company_email,
  COUNT(*) as connects
FROM vdp_calls
WHERE updated_at >= CURRENT_DATE
GROUP BY company_email
ORDER BY connects DESC;

