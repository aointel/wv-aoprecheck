-- Function to update live_call_boardt_recruit stats from agent_dial_metrics
-- Only counts metrics where source='outbound_dialer_recruit'
-- Uses PST timezone for "today" calculation

CREATE OR REPLACE FUNCTION update_live_call_boardt_recruit_stats_for_agent(p_agent_email text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  today_start timestamptz;
  today_end timestamptz;
  dialed_count integer;
  reached_count integer;
  booked_count integer;
BEGIN
  -- Get today's date range in PST timezone, then convert to UTC for querying
  today_start := date_trunc('day', (now() AT TIME ZONE 'America/Los_Angeles')::timestamp) AT TIME ZONE 'America/Los_Angeles';
  today_end := today_start + interval '1 day';
  
  -- Get counts for this agent today - ONLY RECRUIT METRICS (source='outbound_dialer_recruit')
  -- CRITICAL: Each phone number counts ONCE per event type per agent per day (DISTINCT ensures no duplicates)
  --   - DIALS: Count distinct phones where event_type = 'dial' AND source='outbound_dialer_recruit'
  --   - REACHES: Count distinct phones where call_status IN ('answered', 'completed') AND event_type = 'reach' AND source='outbound_dialer_recruit'
  --   - BOOKED: Count distinct phones where event_type = 'booked' AND source='outbound_dialer_recruit' AND call_duration > 120 seconds
  SELECT 
    -- DIALED: Distinct phones only (filters duplicates)
    COUNT(DISTINCT CASE WHEN LOWER(adm.event_type) = 'dial' THEN adm.lead_phone END) as dialed,
    -- REACHED: Just count event_type = 'reach' (already filtered when logged)
    COUNT(DISTINCT CASE 
      WHEN LOWER(adm.event_type) = 'reach'
      THEN adm.lead_phone 
    END) as reached,
    -- BOOKED: Only count if call_duration > 120 seconds (strictly over 2 minutes)
    COUNT(DISTINCT CASE 
      WHEN (LOWER(adm.event_type) = 'booked' OR LOWER(COALESCE(adm.disposition, '')) = 'booked')
        AND adm.lead_phone IS NOT NULL
        AND COALESCE(tcl.call_duration, adm.call_duration, 0) > 120  -- Strictly over 2 minutes
        AND LOWER(COALESCE(tcl.call_status, adm.call_status, '')) IN ('answered', 'completed', 'in-progress')
      THEN adm.lead_phone 
    END) as booked
  INTO dialed_count, reached_count, booked_count
  FROM agent_dial_metrics adm
  LEFT JOIN twilio_call_logs tcl ON adm.call_sid = tcl.twilio_call_sid
  WHERE adm.agent_email = p_agent_email
    AND LOWER(COALESCE(adm.source, '')) = 'outbound_dialer_recruit'
    AND adm.event_timestamp >= today_start
    AND adm.event_timestamp < today_end
    AND adm.lead_phone IS NOT NULL;
  
  -- Update live_call_boardt_recruit (create row if it doesn't exist)
  INSERT INTO live_call_boardt_recruit (
    agent_email,
    status,
    today_dialed,
    today_reached,
    today_booked,
    updated_at
  )
  VALUES (
    p_agent_email,
    'offline',
    COALESCE(dialed_count, 0),
    COALESCE(reached_count, 0),
    COALESCE(booked_count, 0),
    now()
  )
  ON CONFLICT (agent_email) 
  DO UPDATE SET
    -- Always update to the calculated value
    today_dialed = dialed_count,
    today_reached = reached_count,
    today_booked = booked_count,
    updated_at = now();
  
END;
$$;

-- Function to update all agents' recruit stats
CREATE OR REPLACE FUNCTION update_live_call_boardt_recruit_stats_all()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  today_start timestamptz;
  today_end timestamptz;
BEGIN
  -- Get today's date range in PST timezone
  today_start := date_trunc('day', (now() AT TIME ZONE 'America/Los_Angeles')::timestamp) AT TIME ZONE 'America/Los_Angeles';
  today_end := today_start + interval '1 day';
  
  -- Step 1: Update ALL existing rows with connect counts from recruit_candidates (each candidate = 1 connect)
  -- CRITICAL: Update ALL rows, not just ones with candidates (set to 0 if no candidates)
  UPDATE live_call_boardt_recruit lcb
  SET 
    today_connects = COALESCE((
      SELECT COUNT(*)
      FROM recruit_candidates rc
      WHERE rc.agent_email = lcb.agent_email
        AND rc.created_at >= today_start
        AND rc.created_at < today_end
        AND rc.agent_email IS NOT NULL
        AND rc.agent_email != ''
    ), 0),
    updated_at = now();
  
  -- Step 1b: Insert new rows for agents with candidates but no stats yet
  -- Use a subquery to aggregate first, ensuring one row per agent_email
  INSERT INTO live_call_boardt_recruit (
    agent_email,
    agent_name,
    status,
    today_connects,
    updated_at
  )
  SELECT 
    rc_agg.agent_email,
    rc_agg.agent_name,
    'offline' as status,
    rc_agg.connects,
    now() as updated_at
  FROM (
    SELECT 
      rc.agent_email,
      COUNT(*) as connects,
      COALESCE(
        (SELECT agent_name FROM live_call_boardt WHERE agent_email = rc.agent_email LIMIT 1),
        (SELECT agent_name FROM agent_hierarchy WHERE agent_email = rc.agent_email LIMIT 1),
        rc.agent_email
      ) as agent_name
    FROM recruit_candidates rc
    WHERE rc.created_at >= today_start
      AND rc.created_at < today_end
      AND rc.agent_email IS NOT NULL
      AND rc.agent_email != ''
    GROUP BY rc.agent_email
  ) rc_agg
  WHERE NOT EXISTS (
    SELECT 1 FROM live_call_boardt_recruit lcb2 WHERE lcb2.agent_email = rc_agg.agent_email
  )
  ON CONFLICT (agent_email) 
  DO UPDATE SET
    today_connects = EXCLUDED.today_connects,
    agent_name = COALESCE(EXCLUDED.agent_name, live_call_boardt_recruit.agent_name),
    updated_at = EXCLUDED.updated_at;
  
  -- Step 2: Update ALL existing rows with dialed/reached/booked from agent_dial_metrics
  UPDATE live_call_boardt_recruit lcb
  SET 
    today_dialed = COALESCE((
      SELECT COUNT(DISTINCT lead_phone)
      FROM agent_dial_metrics
      WHERE agent_email = lcb.agent_email
        AND LOWER(COALESCE(source, '')) = 'outbound_dialer_recruit'
        AND LOWER(event_type) = 'dial'
        AND event_timestamp >= today_start
        AND event_timestamp < today_end
        AND lead_phone IS NOT NULL
    ), 0),
    today_reached = COALESCE((
      SELECT COUNT(DISTINCT lead_phone)
      FROM agent_dial_metrics
      WHERE agent_email = lcb.agent_email
        AND LOWER(COALESCE(source, '')) = 'outbound_dialer_recruit'
        AND LOWER(event_type) = 'reach'
        AND event_timestamp >= today_start
        AND event_timestamp < today_end
        AND lead_phone IS NOT NULL
    ), 0),
    today_booked = COALESCE((
      SELECT COUNT(DISTINCT adm.lead_phone)
      FROM agent_dial_metrics adm
      LEFT JOIN twilio_call_logs tcl ON adm.call_sid = tcl.twilio_call_sid
      WHERE adm.agent_email = lcb.agent_email
        AND LOWER(COALESCE(adm.source, '')) = 'outbound_dialer_recruit'
        AND (LOWER(adm.event_type) = 'booked' OR LOWER(COALESCE(adm.disposition, '')) = 'booked')
        AND adm.event_timestamp >= today_start
        AND adm.event_timestamp < today_end
        AND adm.lead_phone IS NOT NULL
        AND COALESCE(tcl.call_duration, adm.call_duration, 0) > 120  -- Strictly over 2 minutes
        AND LOWER(COALESCE(tcl.call_status, adm.call_status, '')) IN ('answered', 'completed', 'in-progress')
    ), 0),
    updated_at = now();
  
  -- Step 3: Add NEW agents with dial/reach/booked but no candidates yet (only if they don't exist)
  -- Use a subquery to aggregate first, then insert to avoid duplicates
  INSERT INTO live_call_boardt_recruit (
    agent_email,
    agent_name,
    status,
    today_dialed,
    today_reached,
    today_booked,
    today_connects,
    updated_at
  )
  SELECT 
    adm_agg.agent_email,
    adm_agg.agent_name,
    'offline' as status,
    adm_agg.dialed,
    adm_agg.reached,
    adm_agg.booked,
    0 as connects,
    now() as updated_at
  FROM (
    SELECT 
      adm.agent_email,
      COALESCE(lcb.agent_name, ah.agent_name, adm.agent_email) as agent_name,
      COUNT(DISTINCT CASE WHEN LOWER(adm.event_type) = 'dial' THEN adm.lead_phone END) as dialed,
      COUNT(DISTINCT CASE 
        WHEN LOWER(adm.event_type) = 'reach'
        THEN adm.lead_phone 
      END) as reached,
      COUNT(DISTINCT CASE 
        WHEN (LOWER(adm.event_type) = 'booked' OR LOWER(COALESCE(adm.disposition, '')) = 'booked')
          AND adm.lead_phone IS NOT NULL
          AND COALESCE(tcl.call_duration, adm.call_duration, 0) > 120  -- Strictly over 2 minutes
          AND LOWER(COALESCE(tcl.call_status, adm.call_status, '')) IN ('answered', 'completed', 'in-progress')
        THEN adm.lead_phone 
      END) as booked
    FROM agent_dial_metrics adm
    LEFT JOIN twilio_call_logs tcl ON adm.call_sid = tcl.twilio_call_sid
    LEFT JOIN live_call_boardt lcb ON lcb.agent_email = adm.agent_email
    LEFT JOIN agent_hierarchy ah ON ah.agent_email = adm.agent_email
    WHERE LOWER(COALESCE(adm.source, '')) = 'outbound_dialer_recruit'
      AND adm.event_timestamp >= today_start
      AND adm.event_timestamp < today_end
      AND adm.agent_email IS NOT NULL
      AND adm.agent_email != ''
      AND adm.lead_phone IS NOT NULL
    GROUP BY adm.agent_email, lcb.agent_name, ah.agent_name
  ) adm_agg
  WHERE NOT EXISTS (
    SELECT 1 FROM live_call_boardt_recruit lcb2 WHERE lcb2.agent_email = adm_agg.agent_email
  )
  ON CONFLICT (agent_email) 
  DO UPDATE SET
    today_dialed = EXCLUDED.today_dialed,
    today_reached = EXCLUDED.today_reached,
    today_booked = EXCLUDED.today_booked,
    agent_name = COALESCE(EXCLUDED.agent_name, live_call_boardt_recruit.agent_name),
    updated_at = EXCLUDED.updated_at;
  
END;
$$;

-- Function to update recruit connects from recruit_candidates
-- Each candidate in recruit_candidates = 1 connect
-- CRITICAL: Updates ALL rows in the table, not just ones with candidates
CREATE OR REPLACE FUNCTION update_live_call_boardt_recruit_connects()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  today_start timestamptz;
  today_end timestamptz;
BEGIN
  -- Get today's date range in PST timezone
  today_start := date_trunc('day', (now() AT TIME ZONE 'America/Los_Angeles')::timestamp) AT TIME ZONE 'America/Los_Angeles';
  today_end := today_start + interval '1 day';
  
  -- CRITICAL: Update ALL rows in the table with connect counts (including 0 if no candidates)
  -- This ensures all agents get their correct connect count, not just ones with candidates
  UPDATE live_call_boardt_recruit lcb
  SET 
    today_connects = COALESCE((
      SELECT COUNT(*)
      FROM recruit_candidates rc
      WHERE rc.agent_email = lcb.agent_email
        AND rc.created_at >= today_start
        AND rc.created_at < today_end
        AND rc.agent_email IS NOT NULL
        AND rc.agent_email != ''
    ), 0),
    updated_at = now();
  
  -- Also insert new rows for agents with candidates but no stats yet
  -- Use subquery to aggregate first, ensuring one row per agent_email
  INSERT INTO live_call_boardt_recruit (
    agent_email,
    agent_name,
    status,
    today_connects,
    updated_at
  )
  SELECT 
    rc_agg.agent_email,
    rc_agg.agent_name,
    'offline' as status,
    rc_agg.connects,
    now() as updated_at
  FROM (
    SELECT 
      rc.agent_email,
      COUNT(*) as connects,
      COALESCE(
        (SELECT agent_name FROM live_call_boardt WHERE agent_email = rc.agent_email LIMIT 1),
        (SELECT agent_name FROM agent_hierarchy WHERE agent_email = rc.agent_email LIMIT 1),
        rc.agent_email
      ) as agent_name
    FROM recruit_candidates rc
    WHERE rc.created_at >= today_start
      AND rc.created_at < today_end
      AND rc.agent_email IS NOT NULL
      AND rc.agent_email != ''
    GROUP BY rc.agent_email
  ) rc_agg
  WHERE NOT EXISTS (
    SELECT 1 FROM live_call_boardt_recruit lcb2 
    WHERE lcb2.agent_email = rc_agg.agent_email
  )
  ON CONFLICT (agent_email) 
  DO UPDATE SET
    today_connects = EXCLUDED.today_connects,
    agent_name = COALESCE(EXCLUDED.agent_name, live_call_boardt_recruit.agent_name),
    updated_at = EXCLUDED.updated_at;
  
END;
$$;

-- Function to sync VDP status to live_call_boardt_recruit for recruit agents
-- This ensures agents who go online in recruiting VDP get an entry in the table
-- so managers can see they're online/waiting, even if they haven't made calls yet
CREATE OR REPLACE FUNCTION sync_vdp_status_to_recruit_table()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  vdp_agents jsonb;
  agent_record jsonb;
  agent_email text;
  agent_status text;
  agent_name text;
BEGIN
  -- This function will be called from TypeScript with VDP agent data
  -- For now, we'll create a version that can be called from the backend
  -- The backend will pass the list of online/calling recruit agents
  
  -- Note: This is a placeholder - the actual sync will happen via backend API call
  -- See server/taalk-vdp-poller.ts for the implementation
  RETURN;
END;
$$;

-- Trigger function to update recruit stats when agent_dial_metrics is inserted/updated
CREATE OR REPLACE FUNCTION trigger_update_live_call_boardt_recruit_on_metric()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only process if source is 'outbound_dialer_recruit'
  IF LOWER(COALESCE(NEW.source, '')) = 'outbound_dialer_recruit' THEN
    PERFORM update_live_call_boardt_recruit_stats_for_agent(NEW.agent_email);
  END IF;
  RETURN NEW;
END;
$$;

-- Create triggers on agent_dial_metrics for recruit stats
DROP TRIGGER IF EXISTS trigger_update_live_call_boardt_recruit_on_metric_insert ON agent_dial_metrics;
CREATE TRIGGER trigger_update_live_call_boardt_recruit_on_metric_insert
  AFTER INSERT ON agent_dial_metrics
  FOR EACH ROW
  WHEN (LOWER(COALESCE(NEW.source, '')) = 'outbound_dialer_recruit')
  EXECUTE FUNCTION trigger_update_live_call_boardt_recruit_on_metric();

DROP TRIGGER IF EXISTS trigger_update_live_call_boardt_recruit_on_metric_update ON agent_dial_metrics;
CREATE TRIGGER trigger_update_live_call_boardt_recruit_on_metric_update
  AFTER UPDATE ON agent_dial_metrics
  FOR EACH ROW
  WHEN (LOWER(COALESCE(NEW.source, '')) = 'outbound_dialer_recruit')
  EXECUTE FUNCTION trigger_update_live_call_boardt_recruit_on_metric();

-- Comments
COMMENT ON FUNCTION update_live_call_boardt_recruit_stats_for_agent IS 'Updates recruit stats for a single agent from agent_dial_metrics where source=outbound_dialer_recruit';
COMMENT ON FUNCTION update_live_call_boardt_recruit_stats_all IS 'Updates recruit stats for all agents from agent_dial_metrics where source=outbound_dialer_recruit';
COMMENT ON FUNCTION update_live_call_boardt_recruit_connects IS 'Updates recruit connects count from recruit_candidates (each candidate = 1 connect)';
