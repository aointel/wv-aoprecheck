-- ============================================================================
-- TEST BOOKED TRIGGER
-- 
-- This script tests if the trigger is working by:
-- 1. Checking if booked events exist in agent_dial_metrics
-- 2. Checking if live_call_board has matching booked counts
-- 3. Showing any discrepancies
-- ============================================================================

DO $$
DECLARE
  today_start timestamptz;
  today_end timestamptz;
  rec RECORD;
  mismatch_rec RECORD;
  mismatch_count integer := 0;
BEGIN
  -- Get today's date range in PST timezone
  today_start := date_trunc('day', (now() AT TIME ZONE 'America/Los_Angeles')::timestamp) AT TIME ZONE 'America/Los_Angeles';
  today_end := today_start + interval '1 day';
  
  RAISE NOTICE '📅 Testing booked stats for today (PST): % to %', today_start, today_end;
  RAISE NOTICE '';
  
  -- Check for booked events in agent_dial_metrics (check BOTH event_type='booked' AND disposition='booked')
  RAISE NOTICE '📊 Booked events in agent_dial_metrics (event_type OR disposition):';
  FOR rec IN 
    SELECT 
      agent_email,
      COUNT(DISTINCT lead_phone) as booked_in_metrics
    FROM agent_dial_metrics
    WHERE event_timestamp >= today_start
      AND event_timestamp < today_end
      AND (event_type = 'booked' OR LOWER(disposition) = 'booked')
      AND agent_email IS NOT NULL
      AND agent_email != ''
      AND lead_phone IS NOT NULL
    GROUP BY agent_email
    ORDER BY booked_in_metrics DESC
  LOOP
    RAISE NOTICE '   %: % booked events', rec.agent_email, rec.booked_in_metrics;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '📋 Booked counts in live_call_board:';
  FOR rec IN 
    SELECT 
      agent_email,
      today_booked
    FROM live_call_board
    WHERE today_booked > 0
    ORDER BY today_booked DESC
    LIMIT 20
  LOOP
    RAISE NOTICE '   %: % booked', rec.agent_email, rec.today_booked;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '🔍 Checking for mismatches...';
  
  -- Find mismatches
  FOR mismatch_rec IN 
    WITH metrics_booked AS (
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
    ),
    board_booked AS (
      SELECT 
        agent_email,
        today_booked
      FROM live_call_board
    )
    SELECT 
      COALESCE(m.agent_email, b.agent_email) as agent_email,
      COALESCE(m.booked_count, 0) as metrics_count,
      COALESCE(b.today_booked, 0) as board_count
    FROM metrics_booked m
    FULL OUTER JOIN board_booked b ON LOWER(m.agent_email) = LOWER(b.agent_email)
    WHERE COALESCE(m.booked_count, 0) != COALESCE(b.today_booked, 0)
  LOOP
    mismatch_count := mismatch_count + 1;
    RAISE NOTICE '   ⚠️  MISMATCH: % - metrics: %, board: %', 
      mismatch_rec.agent_email, mismatch_rec.metrics_count, mismatch_rec.board_count;
  END LOOP;
  
  IF mismatch_count = 0 THEN
    RAISE NOTICE '✅ No mismatches found - trigger is working correctly!';
  ELSE
    RAISE NOTICE '❌ Found % mismatches - trigger may not be working!', mismatch_count;
    RAISE NOTICE '   Run fix-booked-stats-in-live-call-board.sql to fix';
  END IF;
  
END $$;

