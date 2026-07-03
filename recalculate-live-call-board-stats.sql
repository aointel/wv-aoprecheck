-- ============================================================================
-- RECALCULATE LIVE CALL BOARD STATS
-- 
-- Run this after resetting to refill the board with correct stats from agent_dial_metrics
-- ============================================================================

-- Option 1: Use the existing function (if it exists)
SELECT update_live_call_board_stats_from_metrics();

-- If the function doesn't exist, use this manual recalculation:
DO $$
DECLARE
  today_start timestamptz;
  today_end timestamptz;
BEGIN
  -- Get today's PST date range
  today_start := date_trunc('day', (now() AT TIME ZONE 'America/Los_Angeles')::timestamp) AT TIME ZONE 'America/Los_Angeles';
  today_end := today_start + interval '1 day';
  
  RAISE NOTICE 'Recalculating live_call_board stats for today (PST): % to %', today_start, today_end;
  
  -- Recalculate stats for agents with metrics today
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
  
  -- Create rows for agents with metrics but no live_call_board entry
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
  
  RAISE NOTICE '✅ Live call board stats recalculated!';
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

