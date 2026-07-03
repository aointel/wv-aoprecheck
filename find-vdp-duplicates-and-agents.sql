-- Find duplicate VDP calls and which agents own them

-- 1. Count duplicates by leadid
SELECT 
  leadid,
  phone,
  "time",
  agent,
  "firstName",
  "lastName",
  COUNT(*) as duplicate_count,
  STRING_AGG(id::text, ', ' ORDER BY id) as duplicate_ids,
  STRING_AGG(duration, ', ' ORDER BY id) as durations
FROM vdp_calls
GROUP BY leadid, phone, "time", agent, "firstName", "lastName"
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, "time" DESC
LIMIT 50;

-- 2. Map agent IDs to emails
SELECT DISTINCT
  v.agent as associate_id,
  c.company_email,
  c.first_name,
  c.last_name,
  COUNT(*) as total_vdp_entries
FROM vdp_calls v
LEFT JOIN customers c ON c.associate_id::text = v.agent
WHERE v.updated_at >= CURRENT_DATE
GROUP BY v.agent, c.company_email, c.first_name, c.last_name
ORDER BY total_vdp_entries DESC;

-- 3. Total duplicate entries today
SELECT 
  'Total VDP entries today' as info,
  COUNT(*) as total_entries,
  COUNT(DISTINCT leadid) as unique_leads,
  COUNT(*) - COUNT(DISTINCT leadid) as duplicate_entries
FROM vdp_calls
WHERE updated_at >= CURRENT_DATE;

-- 4. Delete the empty duration duplicates (keep the ones WITH duration)
-- DO NOT RUN THIS YET - JUST SHOWS WHAT WOULD BE DELETED
SELECT 
  id,
  leadid,
  phone,
  agent,
  "firstName",
  "lastName",
  duration,
  'WOULD DELETE' as action
FROM vdp_calls
WHERE updated_at >= CURRENT_DATE
  AND (duration = '' OR duration IS NULL)
  AND leadid IN (
    SELECT leadid
    FROM vdp_calls
    WHERE updated_at >= CURRENT_DATE
    GROUP BY leadid
    HAVING COUNT(*) > 1
  )
ORDER BY leadid, id;

