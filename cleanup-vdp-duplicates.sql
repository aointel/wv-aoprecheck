-- Clean up duplicate VDP call entries
-- Keep entries WITH duration, delete entries WITHOUT duration

-- Step 1: Count how many duplicates exist
SELECT 
  'Duplicates to clean' as info,
  COUNT(*) as duplicate_entries_to_delete
FROM vdp_calls v1
WHERE (v1.duration = '' OR v1.duration IS NULL)
  AND EXISTS (
    SELECT 1 
    FROM vdp_calls v2 
    WHERE v2.leadid = v1.leadid 
      AND v2.event = v1.event
      AND v2.phone = v1.phone
      AND v2.duration IS NOT NULL 
      AND v2.duration != ''
      AND v2.id != v1.id
      AND ABS(EXTRACT(EPOCH FROM (v2.time::timestamp - v1.time::timestamp))) < 300
  );

-- Step 2: Delete duplicate entries (keep ones WITH duration)
DELETE FROM vdp_calls
WHERE id IN (
  SELECT v1.id
  FROM vdp_calls v1
  WHERE (v1.duration = '' OR v1.duration IS NULL)
    AND EXISTS (
      SELECT 1 
      FROM vdp_calls v2 
      WHERE v2.leadid = v1.leadid 
        AND v2.event = v1.event
        AND v2.phone = v1.phone
        AND v2.duration IS NOT NULL 
        AND v2.duration != ''
        AND v2.id != v1.id
        AND ABS(EXTRACT(EPOCH FROM (v2.time::timestamp - v1.time::timestamp))) < 300
    )
);

-- Step 3: Verify cleanup
SELECT 
  'After cleanup' as info,
  COUNT(*) as total_entries,
  COUNT(DISTINCT leadid) as unique_leads,
  COUNT(*) - COUNT(DISTINCT leadid) as remaining_duplicates
FROM vdp_calls
WHERE updated_at >= CURRENT_DATE;

-- Step 4: Show agent connect counts after cleanup
SELECT 
  v.agent as associate_id,
  c.company_email,
  c.first_name,
  c.last_name,
  COUNT(*) as correct_connect_count
FROM vdp_calls v
LEFT JOIN customers c ON c.associate_id::text = v.agent
WHERE v.updated_at >= CURRENT_DATE
GROUP BY v.agent, c.company_email, c.first_name, c.last_name
ORDER BY correct_connect_count DESC;

