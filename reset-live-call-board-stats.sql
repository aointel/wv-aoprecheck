-- ============================================================================
-- RESET LIVE CALL BOARD STATS
-- 
-- This script completely resets and recalculates all live_call_board stats
-- from agent_dial_metrics using the correct logic:
-- 1. Each phone number counts ONCE per agent per day (DISTINCT)
-- 2. Reached can NEVER exceed dialed (only count reached if dialed exists)
-- 3. Uses PST timezone for "today" calculation
-- 4. Sets stats to 0 for agents with no metrics today
-- ============================================================================

-- Step 1: Get today's PST date range
DO $$
DECLARE
  today_start timestamptz;
  today_end timestamptz;
  invalid_count integer;
BEGIN
  -- Get today's date range in PST timezone
  today_start := date_trunc('day', (now() AT TIME ZONE 'America/Los_Angeles')::timestamp) AT TIME ZONE 'America/Los_Angeles';
  today_end := today_start + interval '1 day';
  
  RAISE NOTICE 'Resetting live_call_board stats for today (PST): % to %', today_start, today_end;
  
  -- Step 2: Reset ALL agents' stats to 0 first (clean slate)
  UPDATE live_call_board
  SET 
    today_dialed = 0,
    today_reached = 0,
    today_booked = 0,
    updated_at = now();
  
  RAISE NOTICE 'Reset all agents stats to 0';
  
  -- Step 3: Recalculate stats for agents with metrics today
  -- CRITICAL: Only count reached if there's also a dial for that phone
  UPDATE live_call_board lcb
  SET 
    today_dialed = COALESCE(stats.dialed_count, 0),
    today_reached = COALESCE(stats.reached_count, 0),
    today_booked = COALESCE(stats.booked_count, 0),
    updated_at = now()
  FROM (
    SELECT 
      agent_email,
      -- Count distinct dialed phones
      COUNT(DISTINCT CASE WHEN event_type = 'dial' THEN lead_phone END) as dialed_count,
      -- Count distinct reached phones, BUT only if there's also a dial for that phone
      COUNT(DISTINCT CASE 
        WHEN event_type = 'reach' 
        AND EXISTS (
          SELECT 1 
          FROM agent_dial_metrics adm2 
          WHERE adm2.agent_email = adm.agent_email 
            AND adm2.lead_phone = adm.lead_phone 
            AND adm2.event_type = 'dial'
            AND adm2.event_timestamp >= today_start 
            AND adm2.event_timestamp < today_end
        )
        THEN lead_phone 
      END) as reached_count,
      -- Count distinct booked phones, BUT only if there's also a dial for that phone
      COUNT(DISTINCT CASE 
        WHEN event_type = 'booked' 
        AND EXISTS (
          SELECT 1 
          FROM agent_dial_metrics adm3 
          WHERE adm3.agent_email = adm.agent_email 
            AND adm3.lead_phone = adm.lead_phone 
            AND adm3.event_type = 'dial'
            AND adm3.event_timestamp >= today_start 
            AND adm3.event_timestamp < today_end
        )
        THEN lead_phone 
      END) as booked_count
    FROM agent_dial_metrics adm
    WHERE adm.event_timestamp >= today_start
      AND adm.event_timestamp < today_end
      AND adm.agent_email IS NOT NULL
      AND adm.agent_email != ''
      AND adm.lead_phone IS NOT NULL
    GROUP BY agent_email
  ) stats
  WHERE LOWER(lcb.agent_email) = LOWER(stats.agent_email);
  
  RAISE NOTICE 'Recalculated stats for agents with metrics today';
  
  -- Step 4: Create rows for agents with metrics but no live_call_board entry
  INSERT INTO live_call_board (
    agent_email,
    status,
    today_dialed,
    today_reached,
    today_booked,
    updated_at
  )
  SELECT 
    stats.agent_email,
    'offline' as status,
    COALESCE(stats.dialed_count, 0) as today_dialed,
    COALESCE(stats.reached_count, 0) as today_reached,
    COALESCE(stats.booked_count, 0) as today_booked,
    now() as updated_at
  FROM (
    SELECT 
      agent_email,
      COUNT(DISTINCT CASE WHEN event_type = 'dial' THEN lead_phone END) as dialed_count,
      COUNT(DISTINCT CASE 
        WHEN event_type = 'reach' 
        AND EXISTS (
          SELECT 1 
          FROM agent_dial_metrics adm2 
          WHERE adm2.agent_email = adm.agent_email 
            AND adm2.lead_phone = adm.lead_phone 
            AND adm2.event_type = 'dial'
            AND adm2.event_timestamp >= today_start 
            AND adm2.event_timestamp < today_end
        )
        THEN lead_phone 
      END) as reached_count,
      COUNT(DISTINCT CASE 
        WHEN event_type = 'booked' 
        AND EXISTS (
          SELECT 1 
          FROM agent_dial_metrics adm3 
          WHERE adm3.agent_email = adm.agent_email 
            AND adm3.lead_phone = adm.lead_phone 
            AND adm3.event_type = 'dial'
            AND adm3.event_timestamp >= today_start 
            AND adm3.event_timestamp < today_end
        )
        THEN lead_phone 
      END) as booked_count
    FROM agent_dial_metrics adm
    WHERE adm.event_timestamp >= today_start
      AND adm.event_timestamp < today_end
      AND adm.agent_email IS NOT NULL
      AND adm.agent_email != ''
      AND adm.lead_phone IS NOT NULL
    GROUP BY agent_email
  ) stats
  WHERE NOT EXISTS (
    SELECT 1 FROM live_call_board lcb 
    WHERE LOWER(lcb.agent_email) = LOWER(stats.agent_email)
  )
  ON CONFLICT (agent_email) DO NOTHING;
  
  RAISE NOTICE 'Created rows for new agents with metrics';
  
  -- Step 5: Verify no agent has reached > dialed (safety check)
  SELECT COUNT(*) INTO invalid_count
  FROM live_call_board
  WHERE today_reached > today_dialed;
  
  IF invalid_count > 0 THEN
    RAISE WARNING 'Found % agents with reached > dialed. This should not happen!', invalid_count;
    -- Force fix: set reached to dialed if reached > dialed
    UPDATE live_call_board
    SET today_reached = today_dialed
    WHERE today_reached > today_dialed;
    RAISE NOTICE 'Fixed invalid stats: set reached = dialed where reached > dialed';
  ELSE
    RAISE NOTICE 'Verification passed: No agents with reached > dialed';
  END IF;
  
  RAISE NOTICE '✅ Live call board stats reset complete!';
END $$;

-- Display summary
SELECT 
  agent_email,
  today_dialed,
  today_reached,
  today_booked,
  CASE 
    WHEN today_reached > today_dialed THEN '⚠️ INVALID'
    ELSE '✅ OK'
  END as status
FROM live_call_board
WHERE today_dialed > 0 OR today_reached > 0 OR today_booked > 0
ORDER BY today_dialed DESC, agent_email
LIMIT 50;

