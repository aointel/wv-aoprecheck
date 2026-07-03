-- ============================================================================
-- FIX BOOKED STATS IN LIVE_CALL_BOARD
-- 
-- This script manually recalculates today_booked for all agents from
-- agent_dial_metrics where event_type = 'booked'
-- ============================================================================

DO $$
DECLARE
  today_start timestamptz;
  today_end timestamptz;
  updated_count integer;
  rec RECORD;
BEGIN
  -- Get today's date range in PST timezone
  today_start := date_trunc('day', (now() AT TIME ZONE 'America/Los_Angeles')::timestamp) AT TIME ZONE 'America/Los_Angeles';
  today_end := today_start + interval '1 day';
  
  RAISE NOTICE '📅 Today range (PST): % to %', today_start, today_end;
  
  -- Update live_call_board with booked counts from agent_dial_metrics
  -- Count DISTINCT lead_phone where event_type = 'booked' OR disposition = 'booked'
  WITH booked_stats AS (
    SELECT 
      agent_email,
      COUNT(DISTINCT lead_phone) as booked_count
    FROM agent_dial_metrics
    WHERE event_timestamp >= today_start
      AND event_timestamp < today_end
      AND (event_type = 'booked' OR LOWER(disposition) = 'booked')
      AND agent_email IS NOT NULL
      AND agent_email != ''
      AND lead_phone IS NOT NULL
    GROUP BY agent_email
  )
  UPDATE live_call_board lcb
  SET 
    today_booked = COALESCE(bs.booked_count, 0),
    updated_at = now()
  FROM booked_stats bs
  WHERE LOWER(lcb.agent_email) = LOWER(bs.agent_email);
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  RAISE NOTICE '✅ Updated today_booked for % agents', updated_count;
  
  -- Also set to 0 for agents with no booked events today (if they had booked > 0 before)
  UPDATE live_call_board
  SET 
    today_booked = 0,
    updated_at = now()
  WHERE agent_email NOT IN (
    SELECT DISTINCT agent_email 
    FROM agent_dial_metrics
    WHERE event_timestamp >= today_start
      AND event_timestamp < today_end
      AND (event_type = 'booked' OR LOWER(disposition) = 'booked')
      AND agent_email IS NOT NULL
      AND agent_email != ''
      AND lead_phone IS NOT NULL
  )
  AND today_booked > 0;
  
  RAISE NOTICE '✅ Reset booked count to 0 for agents with no booked events today';
  
  -- Show summary
  RAISE NOTICE '';
  RAISE NOTICE '📊 Summary of booked events today:';
  FOR rec IN 
    SELECT 
      agent_email,
      COUNT(DISTINCT lead_phone) as booked_count
    FROM agent_dial_metrics
    WHERE event_timestamp >= today_start
      AND event_timestamp < today_end
      AND (event_type = 'booked' OR LOWER(disposition) = 'booked')
      AND agent_email IS NOT NULL
      AND agent_email != ''
      AND lead_phone IS NOT NULL
    GROUP BY agent_email
    ORDER BY booked_count DESC
    LIMIT 10
  LOOP
    RAISE NOTICE '   %: % booked', rec.agent_email, rec.booked_count;
  END LOOP;
  
END $$;

