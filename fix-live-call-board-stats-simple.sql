-- ============================================================================
-- FIX LIVE CALL BOARD STATS - SIMPLE VERSION
-- This will recalculate ALL stats from agent_dial_metrics for today
-- ============================================================================

-- First, try using the existing function
SELECT update_live_call_board_stats_from_metrics();

-- If that doesn't work, use this direct update:
DO $$
DECLARE
  today_start timestamptz;
  today_end timestamptz;
BEGIN
  -- Get today's PST date range
  today_start := date_trunc('day', (now() AT TIME ZONE 'America/Los_Angeles')::timestamp) AT TIME ZONE 'America/Los_Angeles';
  today_end := today_start + interval '1 day';
  
  RAISE NOTICE 'Recalculating stats for today (PST): % to %', today_start, today_end;
  
  -- Update all existing agents
  UPDATE live_call_board lcb
  SET 
    today_dialed = COALESCE((
      SELECT COUNT(DISTINCT lead_phone)
      FROM agent_dial_metrics
      WHERE agent_email = lcb.agent_email
        AND event_type = 'dial'
        AND event_timestamp >= today_start
        AND event_timestamp < today_end
        AND lead_phone IS NOT NULL
    ), 0),
    today_reached = COALESCE((
      SELECT COUNT(DISTINCT lead_phone)
      FROM agent_dial_metrics
      WHERE agent_email = lcb.agent_email
        AND event_type = 'reach'
        AND event_timestamp >= today_start
        AND event_timestamp < today_end
        AND lead_phone IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM agent_dial_metrics adm2
          WHERE adm2.agent_email = agent_dial_metrics.agent_email
            AND adm2.lead_phone = agent_dial_metrics.lead_phone
            AND adm2.event_type = 'dial'
            AND adm2.event_timestamp >= today_start
            AND adm2.event_timestamp < today_end
        )
    ), 0),
    today_booked = COALESCE((
      SELECT COUNT(DISTINCT lead_phone)
      FROM agent_dial_metrics
      WHERE agent_email = lcb.agent_email
        AND event_type = 'booked'
        AND event_timestamp >= today_start
        AND event_timestamp < today_end
        AND lead_phone IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM agent_dial_metrics adm2
          WHERE adm2.agent_email = agent_dial_metrics.agent_email
            AND adm2.lead_phone = agent_dial_metrics.lead_phone
            AND adm2.event_type = 'dial'
            AND adm2.event_timestamp >= today_start
            AND adm2.event_timestamp < today_end
        )
    ), 0),
    updated_at = now();
  
  RAISE NOTICE 'Updated existing agents';
  
  -- Insert new agents with metrics
  INSERT INTO live_call_board (
    agent_email,
    status,
    today_dialed,
    today_reached,
    today_booked,
    updated_at
  )
  SELECT DISTINCT
    agent_email,
    'offline',
    COALESCE((
      SELECT COUNT(DISTINCT lead_phone)
      FROM agent_dial_metrics adm
      WHERE adm.agent_email = stats.agent_email
        AND adm.event_type = 'dial'
        AND adm.event_timestamp >= today_start
        AND adm.event_timestamp < today_end
        AND adm.lead_phone IS NOT NULL
    ), 0),
    COALESCE((
      SELECT COUNT(DISTINCT lead_phone)
      FROM agent_dial_metrics adm
      WHERE adm.agent_email = stats.agent_email
        AND adm.event_type = 'reach'
        AND adm.event_timestamp >= today_start
        AND adm.event_timestamp < today_end
        AND adm.lead_phone IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM agent_dial_metrics adm2
          WHERE adm2.agent_email = adm.agent_email
            AND adm2.lead_phone = adm.lead_phone
            AND adm2.event_type = 'dial'
            AND adm2.event_timestamp >= today_start
            AND adm2.event_timestamp < today_end
        )
    ), 0),
    COALESCE((
      SELECT COUNT(DISTINCT lead_phone)
      FROM agent_dial_metrics adm
      WHERE adm.agent_email = stats.agent_email
        AND adm.event_type = 'booked'
        AND adm.event_timestamp >= today_start
        AND adm.event_timestamp < today_end
        AND adm.lead_phone IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM agent_dial_metrics adm2
          WHERE adm2.agent_email = adm.agent_email
            AND adm2.lead_phone = adm.lead_phone
            AND adm2.event_type = 'dial'
            AND adm2.event_timestamp >= today_start
            AND adm2.event_timestamp < today_end
        )
    ), 0),
    now()
  FROM (
    SELECT DISTINCT agent_email
    FROM agent_dial_metrics
    WHERE event_timestamp >= today_start
      AND event_timestamp < today_end
      AND agent_email IS NOT NULL
      AND agent_email != ''
  ) stats
  WHERE NOT EXISTS (
    SELECT 1 FROM live_call_board WHERE agent_email = stats.agent_email
  );
  
  RAISE NOTICE 'Inserted new agents';
  
  -- Fix any invalid stats (reached > dialed)
  UPDATE live_call_board
  SET today_reached = today_dialed
  WHERE today_reached > today_dialed;
  
  RAISE NOTICE '✅ Stats recalculated!';
END $$;

-- Show results
SELECT 
  agent_email,
  today_dialed,
  today_reached,
  today_booked,
  updated_at
FROM live_call_board
WHERE today_dialed > 0 OR today_reached > 0 OR today_booked > 0
ORDER BY today_dialed DESC
LIMIT 20;


