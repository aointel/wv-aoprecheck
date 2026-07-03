-- COMPREHENSIVE FIX: Repair all corrupted agent_mga_team fields
-- This fixes sessions where agent_mga_team was set to agent's own name instead of their real MGA team

BEGIN;

-- Step 1: Count how many bad records we have
SELECT 
  COUNT(*) as total_bad_records,
  COUNT(DISTINCT company_email) as unique_agents_affected
FROM verification_sessions
WHERE agent_mga_team IS NOT NULL
  AND agent_first_name IS NOT NULL
  AND agent_last_name IS NOT NULL
  AND UPPER(agent_mga_team) = UPPER(TRIM(agent_first_name || ' ' || agent_last_name));

-- Step 2: Fix by associate_id (most reliable)
UPDATE verification_sessions v
SET 
  agent_mga_team = h.mga_name,
  agent_rga_team = COALESCE(h.rga_name, v.agent_rga_team),
  updated_at = NOW()
FROM agent_hierarchy h
WHERE v.associate_id IS NOT NULL
  AND v.associate_id::text = h.agent_associate_id::text
  AND v.agent_mga_team IS NOT NULL
  AND v.agent_first_name IS NOT NULL
  AND v.agent_last_name IS NOT NULL
  AND UPPER(v.agent_mga_team) = UPPER(TRIM(v.agent_first_name || ' ' || v.agent_last_name))
  AND h.mga_name IS NOT NULL
  AND h.mga_name != '0'
  AND h.mga_name != '';

-- Step 3: Fix by company_email (fallback if associate_id didn't work)
UPDATE verification_sessions v
SET 
  agent_mga_team = h.mga_name,
  agent_rga_team = COALESCE(h.rga_name, v.agent_rga_team),
  updated_at = NOW()
FROM agent_hierarchy h
WHERE v.company_email IS NOT NULL
  AND LOWER(TRIM(v.company_email)) = LOWER(TRIM(h.agent_email))
  AND v.agent_mga_team IS NOT NULL
  AND v.agent_first_name IS NOT NULL
  AND v.agent_last_name IS NOT NULL
  AND UPPER(v.agent_mga_team) = UPPER(TRIM(v.agent_first_name || ' ' || v.agent_last_name))
  AND h.mga_name IS NOT NULL
  AND h.mga_name != '0'
  AND h.mga_name != ''
  AND NOT EXISTS (
    -- Skip if already fixed by associate_id
    SELECT 1 FROM agent_hierarchy h2 
    WHERE v.associate_id IS NOT NULL 
      AND v.associate_id::text = h2.agent_associate_id::text
      AND h2.mga_name IS NOT NULL
  );

-- Step 4: Set to NULL for any remaining self-assigned teams that can't be matched
UPDATE verification_sessions
SET 
  agent_mga_team = NULL,
  updated_at = NOW()
WHERE agent_mga_team IS NOT NULL
  AND agent_first_name IS NOT NULL
  AND agent_last_name IS NOT NULL
  AND UPPER(agent_mga_team) = UPPER(TRIM(agent_first_name || ' ' || agent_last_name));

-- Step 5: Show results - what was fixed
SELECT 
  'FIXED BY ASSOCIATE_ID' as fix_method,
  COUNT(*) as fixed_count
FROM verification_sessions
WHERE updated_at > NOW() - INTERVAL '1 minute'
  AND agent_mga_team IS NOT NULL
  AND agent_mga_team != UPPER(TRIM(agent_first_name || ' ' || agent_last_name))
  AND associate_id IS NOT NULL;

SELECT 
  'FIXED BY EMAIL' as fix_method,
  COUNT(*) as fixed_count
FROM verification_sessions
WHERE updated_at > NOW() - INTERVAL '1 minute'
  AND agent_mga_team IS NOT NULL
  AND agent_mga_team != UPPER(TRIM(agent_first_name || ' ' || agent_last_name))
  AND company_email IS NOT NULL;

SELECT 
  'SET TO NULL (NO MATCH)' as fix_method,
  COUNT(*) as fixed_count
FROM verification_sessions
WHERE updated_at > NOW() - INTERVAL '1 minute'
  AND agent_mga_team IS NULL
  AND agent_first_name IS NOT NULL
  AND agent_last_name IS NOT NULL;

-- Step 6: Show sample of fixed records
SELECT 
  id,
  session_id,
  agent_first_name || ' ' || agent_last_name as agent_name,
  company_email,
  associate_id,
  agent_mga_team as fixed_mga_team,
  agent_rga_team as fixed_rga_team,
  updated_at
FROM verification_sessions
WHERE updated_at > NOW() - INTERVAL '1 minute'
ORDER BY updated_at DESC
LIMIT 20;

-- Step 7: Verify no more bad records remain
SELECT 
  COUNT(*) as remaining_bad_records
FROM verification_sessions
WHERE agent_mga_team IS NOT NULL
  AND agent_first_name IS NOT NULL
  AND agent_last_name IS NOT NULL
  AND UPPER(agent_mga_team) = UPPER(TRIM(agent_first_name || ' ' || agent_last_name));

COMMIT;

-- ROLLBACK if you want to undo: ROLLBACK;
-- COMMIT to save changes: COMMIT; (already done above)




