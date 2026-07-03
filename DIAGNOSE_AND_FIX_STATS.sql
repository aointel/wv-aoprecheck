-- ============================================================================
-- DIAGNOSE AND FIX - Check what's in the data first, then fix
-- ============================================================================

-- Step 1: Check what metrics exist for today
DO $$
DECLARE
  today_start timestamptz;
  today_end timestamptz;
  metric_count integer;
  agent_count integer;
BEGIN
  today_start := date_trunc('day', (now() AT TIME ZONE 'America/Los_Angeles')::timestamp) AT TIME ZONE 'America/Los_Angeles';
  today_end := today_start + interval '1 day';
  
  RAISE NOTICE 'Today range (PST): % to %', today_start, today_end;
  
  SELECT COUNT(*) INTO metric_count
  FROM agent_dial_metrics
  WHERE event_timestamp >= today_start
    AND event_timestamp < today_end;
  
  SELECT COUNT(DISTINCT agent_email) INTO agent_count
  FROM agent_dial_metrics
  WHERE event_timestamp >= today_start
    AND event_timestamp < today_end
    AND agent_email IS NOT NULL;
  
  RAISE NOTICE 'Found % metrics for % agents today', metric_count, agent_count;
END $$;

-- Step 2: Show sample of what's in agent_dial_metrics today
SELECT 
  agent_email,
  event_type,
  COUNT(*) as event_count,
  COUNT(DISTINCT lead_phone) as unique_phones
FROM agent_dial_metrics
WHERE event_timestamp >= date_trunc('day', (now() AT TIME ZONE 'America/Los_Angeles')::timestamp) AT TIME ZONE 'America/Los_Angeles'
  AND event_timestamp < date_trunc('day', (now() AT TIME ZONE 'America/Los_Angeles')::timestamp) AT TIME ZONE 'America/Los_Angeles' + interval '1 day'
  AND agent_email IS NOT NULL
GROUP BY agent_email, event_type
ORDER BY agent_email, event_type
LIMIT 50;

-- Step 3: SIMPLE FIX - Just count distinct phones, no complex EXISTS checks
DO $$
DECLARE
  today_start timestamptz;
  today_end timestamptz;
  updated_count integer;
BEGIN
  today_start := date_trunc('day', (now() AT TIME ZONE 'America/Los_Angeles')::timestamp) AT TIME ZONE 'America/Los_Angeles';
  today_end := today_start + interval '1 day';
  
  RAISE NOTICE 'Fixing stats for today (PST): % to %', today_start, today_end;
  
  -- Update ALL agents - simple distinct count
  UPDATE live_call_board lcb
  SET 
    today_dialed = COALESCE((
      SELECT COUNT(DISTINCT lead_phone)
      FROM agent_dial_metrics
      WHERE LOWER(TRIM(agent_email)) = LOWER(TRIM(lcb.agent_email))
        AND event_type = 'dial'
        AND event_timestamp >= today_start
        AND event_timestamp < today_end
        AND lead_phone IS NOT NULL
    ), 0),
    today_reached = COALESCE((
      SELECT COUNT(DISTINCT lead_phone)
      FROM agent_dial_metrics
      WHERE LOWER(TRIM(agent_email)) = LOWER(TRIM(lcb.agent_email))
        AND event_type = 'reach'
        AND event_timestamp >= today_start
        AND event_timestamp < today_end
        AND lead_phone IS NOT NULL
    ), 0),
    today_booked = COALESCE((
      SELECT COUNT(DISTINCT lead_phone)
      FROM agent_dial_metrics
      WHERE LOWER(TRIM(agent_email)) = LOWER(TRIM(lcb.agent_email))
        AND event_type = 'booked'
        AND event_timestamp >= today_start
        AND event_timestamp < today_end
        AND lead_phone IS NOT NULL
    ), 0),
    updated_at = now();
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % agents', updated_count;
  
  -- Insert new agents
  INSERT INTO live_call_board (agent_email, status, today_dialed, today_reached, today_booked, updated_at)
  SELECT 
    stats.agent_email,
    'offline',
    COALESCE(stats.dialed, 0),
    COALESCE(stats.reached, 0),
    COALESCE(stats.booked, 0),
    now()
  FROM (
    SELECT 
      LOWER(TRIM(agent_email)) as agent_email,
      COUNT(DISTINCT CASE WHEN event_type = 'dial' THEN lead_phone END) as dialed,
      COUNT(DISTINCT CASE WHEN event_type = 'reach' THEN lead_phone END) as reached,
      COUNT(DISTINCT CASE WHEN event_type = 'booked' THEN lead_phone END) as booked
    FROM agent_dial_metrics
    WHERE event_timestamp >= today_start
      AND event_timestamp < today_end
      AND agent_email IS NOT NULL
      AND agent_email != ''
      AND lead_phone IS NOT NULL
    GROUP BY LOWER(TRIM(agent_email))
  ) stats
  WHERE NOT EXISTS (
    SELECT 1 FROM live_call_board WHERE LOWER(TRIM(agent_email)) = stats.agent_email
  );
  
  RAISE NOTICE 'Inserted new agents';
  
  -- Fix invalid stats
  UPDATE live_call_board
  SET today_reached = LEAST(today_reached, today_dialed),
      today_booked = LEAST(today_booked, today_dialed)
  WHERE today_reached > today_dialed OR today_booked > today_dialed;
  
  RAISE NOTICE '✅ DONE!';
END $$;

-- Step 4: Show results
SELECT 
  agent_email,
  today_dialed,
  today_reached,
  today_booked,
  updated_at,
  CASE 
    WHEN today_reached > today_dialed THEN '⚠️ INVALID'
    WHEN today_booked > today_dialed THEN '⚠️ INVALID'
    ELSE '✅ OK'
  END as status
FROM live_call_board
WHERE today_dialed > 0 OR today_reached > 0 OR today_booked > 0
ORDER BY today_dialed DESC;

