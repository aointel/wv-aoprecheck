-- FIX: REACHED should be counted from agent_dial_metrics (event_type = 'reach'), NOT from twilio_call_logs
-- This ensures reached matches what was actually logged, not what twilio_call_logs says
-- Also adds today_connects column to track connects from billing_transactions

-- Add today_connects column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'live_call_boardt' 
    AND column_name = 'today_connects'
  ) THEN
    ALTER TABLE live_call_boardt ADD COLUMN today_connects integer DEFAULT 0;
    COMMENT ON COLUMN live_call_boardt.today_connects IS 'Number of connects today (from billing_transactions where transaction_type = connect)';
  END IF;
END $$;

DROP FUNCTION IF EXISTS update_live_call_boardt_stats_from_metrics() CASCADE;

CREATE OR REPLACE FUNCTION update_live_call_boardt_stats_from_metrics()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  today_start timestamptz;
  today_end timestamptz;
BEGIN
  -- Get today's date range in EST timezone
  today_start := date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York';
  today_end := today_start + interval '1 day';
  
  -- Update live_call_boardt with today's stats
  -- DIALED: From twilio_call_logs (outbound calls with duration >= 15s, DISTINCT by to_number)
  -- REACHED: From agent_dial_metrics (event_type = 'reach') - COUNT DISTINCT lead_phone
  -- BOOKED: From agent_dial_metrics (event_type = 'booked') - COUNT DISTINCT lead_phone
  -- CONNECTS: From billing_transactions (transaction_type = 'connect') - COUNT by agent_email
  INSERT INTO live_call_boardt (
    agent_email,
    status,
    today_dialed,
    today_reached,
    today_booked,
    today_instant_presentation,
    today_connects,
    updated_at
  )
  SELECT 
    COALESCE(dialed_stats.agent_email, metrics_stats.agent_email, connects_stats.agent_email) as agent_email,
    'offline' as status,
    COALESCE(dialed_stats.dialed, 0) as dialed,
    COALESCE(metrics_stats.reached, 0) as reached,
    COALESCE(metrics_stats.booked, 0) as booked,
    COALESCE(metrics_stats.instant_presentation, 0) as instant_presentation,
    COALESCE(connects_stats.connects, 0) as connects,
    now() as updated_at
  FROM (
    -- DIALED: Count distinct phone numbers from twilio_call_logs (only calls with duration >= 15s)
    SELECT 
      tcl.owner_email as agent_email,
      COUNT(DISTINCT tcl.to_number) as dialed
    FROM (
      SELECT DISTINCT ON (owner_email, to_number)
        owner_email,
        to_number,
        call_direction,
        call_duration,
        call_status
      FROM twilio_call_logs
      WHERE call_started_at >= today_start
        AND call_started_at < today_end
        AND owner_email IS NOT NULL
        AND owner_email != ''
        AND call_direction = 'outbound'
        AND call_duration IS NOT NULL
        AND call_duration >= 15
        AND to_number IS NOT NULL
        AND to_number != ''
        AND LOWER(COALESCE(call_status, '')) NOT IN ('failed', 'busy', 'no-answer', 'canceled')
      ORDER BY owner_email, to_number, call_started_at DESC
    ) tcl
    GROUP BY tcl.owner_email
  ) dialed_stats
  FULL OUTER JOIN (
    -- REACHED/BOOKED/INSTANT_PRESENTATION: From agent_dial_metrics (where events are actually logged)
    -- CRITICAL: Count DISTINCT lead_phone - each phone counts ONCE per agent (not per day, just once total)
    -- CRITICAL: EXCLUDE records with no duration (call_duration IS NULL or call_duration = 0)
    SELECT
      adm.agent_email,
      -- REACHED: Count distinct phones where event_type = 'reach' AND has duration > 0
      COUNT(DISTINCT CASE 
        WHEN LOWER(adm.event_type) = 'reach'
          AND adm.call_duration IS NOT NULL
          AND adm.call_duration > 0
        THEN adm.lead_phone 
      END) as reached,
      -- BOOKED: Count distinct phones where event_type = 'booked' AND has duration > 0
      COUNT(DISTINCT CASE 
        WHEN LOWER(adm.event_type) = 'booked'
          AND adm.call_duration IS NOT NULL
          AND adm.call_duration > 0
        THEN adm.lead_phone 
      END) as booked,
      -- INSTANT_PRESENTATION: Count distinct phones where event_type = 'instant_presentation' AND has duration > 0
      COUNT(DISTINCT CASE 
        WHEN LOWER(adm.event_type) = 'instant_presentation'
          AND adm.call_duration IS NOT NULL
          AND adm.call_duration > 0
        THEN adm.lead_phone 
      END) as instant_presentation
    FROM agent_dial_metrics adm
    WHERE adm.event_timestamp >= today_start
      AND adm.event_timestamp < today_end
      AND adm.agent_email IS NOT NULL
      AND adm.agent_email != ''
      AND adm.lead_phone IS NOT NULL
    GROUP BY adm.agent_email
  ) metrics_stats ON dialed_stats.agent_email = metrics_stats.agent_email
  FULL OUTER JOIN (
    -- CONNECTS: Count from billing_transactions where transaction_type = 'connect'
    SELECT
      bt.agent_email,
      COUNT(*) as connects
    FROM billing_transactions bt
    WHERE bt.transaction_type = 'connect'
      AND bt.transaction_date >= today_start
      AND bt.transaction_date < today_end
      AND bt.agent_email IS NOT NULL
      AND bt.agent_email != ''
    GROUP BY bt.agent_email
  ) connects_stats ON COALESCE(dialed_stats.agent_email, metrics_stats.agent_email) = connects_stats.agent_email
    OR (dialed_stats.agent_email IS NULL AND metrics_stats.agent_email IS NULL AND connects_stats.agent_email IS NOT NULL)
  WHERE COALESCE(dialed_stats.agent_email, metrics_stats.agent_email, connects_stats.agent_email) IS NOT NULL
  ON CONFLICT (agent_email) 
  DO UPDATE SET
    today_dialed = EXCLUDED.today_dialed,
    today_reached = EXCLUDED.today_reached,
    today_booked = EXCLUDED.today_booked,
    today_instant_presentation = EXCLUDED.today_instant_presentation,
    today_connects = EXCLUDED.today_connects,
    updated_at = EXCLUDED.updated_at;
  
  -- CRITICAL: Update connects for ALL agents who have connects in billing_transactions
  -- This ensures connects are always up-to-date, even if the agent wasn't in the first INSERT
  UPDATE live_call_boardt lcb
  SET 
    today_connects = bt_agg.connects,
    updated_at = now()
  FROM (
    SELECT
      bt.agent_email,
      COUNT(*) as connects
    FROM billing_transactions bt
    WHERE bt.transaction_type = 'connect'
      AND bt.transaction_date >= today_start
      AND bt.transaction_date < today_end
      AND bt.agent_email IS NOT NULL
      AND bt.agent_email != ''
    GROUP BY bt.agent_email
  ) bt_agg
  WHERE lcb.agent_email = bt_agg.agent_email;
  
  -- CRITICAL: Insert agents who have connects but aren't in live_call_boardt yet
  INSERT INTO live_call_boardt (
    agent_email,
    status,
    today_dialed,
    today_reached,
    today_booked,
    today_instant_presentation,
    today_connects,
    updated_at
  )
  SELECT
    bt_agg.agent_email,
    'offline' as status,
    0 as dialed,
    0 as reached,
    0 as booked,
    0 as instant_presentation,
    bt_agg.connects,
    now() as updated_at
  FROM (
    SELECT
      bt.agent_email,
      COUNT(*) as connects
    FROM billing_transactions bt
    WHERE bt.transaction_type = 'connect'
      AND bt.transaction_date >= today_start
      AND bt.transaction_date < today_end
      AND bt.agent_email IS NOT NULL
      AND bt.agent_email != ''
    GROUP BY bt.agent_email
  ) bt_agg
  WHERE NOT EXISTS (
    SELECT 1 FROM live_call_boardt lcb 
    WHERE lcb.agent_email = bt_agg.agent_email
  );
END;
$$;

-- Also update the single-agent function (used by triggers)
DROP FUNCTION IF EXISTS update_live_call_boardt_stats_for_agent(text) CASCADE;

CREATE OR REPLACE FUNCTION update_live_call_boardt_stats_for_agent(p_agent_email text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  today_start timestamptz;
  today_end timestamptz;
  dialed_count integer;
  reached_count integer;
  booked_count integer;
  instant_presentation_count integer;
  connects_count integer;
BEGIN
  today_start := date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York';
  today_end := today_start + interval '1 day';
  
  -- DIALED: From twilio_call_logs
  SELECT COUNT(DISTINCT tcl.to_number)
  INTO dialed_count
  FROM twilio_call_logs tcl
  WHERE tcl.owner_email = p_agent_email
    AND tcl.call_started_at >= today_start
    AND tcl.call_started_at < today_end
    AND tcl.call_direction = 'outbound'
    AND tcl.call_duration IS NOT NULL
    AND tcl.call_duration >= 15
    AND tcl.to_number IS NOT NULL
    AND tcl.to_number != ''
    AND LOWER(COALESCE(tcl.call_status, '')) NOT IN ('failed', 'busy', 'no-answer', 'canceled');
  
  -- REACHED/BOOKED/INSTANT_PRESENTATION: From agent_dial_metrics
  -- CRITICAL: REACHED counts from event_type = 'reach', NOT from call_status
  -- CRITICAL: EXCLUDE records with no duration (call_duration IS NULL or call_duration = 0)
  SELECT
    COUNT(DISTINCT CASE 
      WHEN LOWER(adm.event_type) = 'reach'
        AND adm.call_duration IS NOT NULL
        AND adm.call_duration > 0
      THEN adm.lead_phone 
    END) as reached,
    COUNT(DISTINCT CASE 
      WHEN LOWER(adm.event_type) = 'booked'
        AND adm.call_duration IS NOT NULL
        AND adm.call_duration > 0
      THEN adm.lead_phone 
    END) as booked,
    COUNT(DISTINCT CASE 
      WHEN LOWER(adm.event_type) = 'instant_presentation'
        AND adm.call_duration IS NOT NULL
        AND adm.call_duration > 0
      THEN adm.lead_phone 
    END) as instant_presentation
  INTO reached_count, booked_count, instant_presentation_count
  FROM agent_dial_metrics adm
  WHERE adm.agent_email = p_agent_email
    AND adm.event_timestamp >= today_start
    AND adm.event_timestamp < today_end
    AND adm.lead_phone IS NOT NULL;
  
  -- CONNECTS: Count from billing_transactions where transaction_type = 'connect'
  SELECT COUNT(*)
  INTO connects_count
  FROM billing_transactions bt
  WHERE bt.agent_email = p_agent_email
    AND bt.transaction_type = 'connect'
    AND bt.transaction_date >= today_start
    AND bt.transaction_date < today_end;
  
  INSERT INTO live_call_boardt (
    agent_email,
    status,
    today_dialed,
    today_reached,
    today_booked,
    today_instant_presentation,
    today_connects,
    updated_at
  )
  VALUES (
    p_agent_email,
    'offline',
    COALESCE(dialed_count, 0),
    COALESCE(reached_count, 0),
    COALESCE(booked_count, 0),
    COALESCE(instant_presentation_count, 0),
    COALESCE(connects_count, 0),
    now()
  )
  ON CONFLICT (agent_email) 
  DO UPDATE SET
    today_dialed = dialed_count,
    today_reached = reached_count,
    today_booked = booked_count,
    today_instant_presentation = instant_presentation_count,
    today_connects = connects_count,
    updated_at = now();
END;
$$;

-- Step 3: Create/update trigger function
CREATE OR REPLACE FUNCTION trigger_update_live_call_boardt_on_metric()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update stats for this agent when a new metric is inserted/updated
  IF NEW.agent_email IS NOT NULL AND NEW.agent_email != '' THEN
    PERFORM update_live_call_boardt_stats_for_agent(NEW.agent_email);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Step 4: Drop old triggers and create new ones (ENSURE THEY'RE ENABLED)
DROP TRIGGER IF EXISTS trigger_update_live_call_board_on_metric_insert ON agent_dial_metrics;
DROP TRIGGER IF EXISTS trigger_update_live_call_board_on_metric ON agent_dial_metrics;
DROP TRIGGER IF EXISTS trigger_update_live_call_board_stats ON agent_dial_metrics;
DROP TRIGGER IF EXISTS trigger_update_live_call_boardt_on_metric_insert ON agent_dial_metrics;
DROP TRIGGER IF EXISTS trigger_update_live_call_board_on_metric_update ON agent_dial_metrics;
DROP TRIGGER IF EXISTS trigger_update_live_call_boardt_on_metric_update ON agent_dial_metrics;

-- Create INSERT trigger (fires immediately when new metric is inserted)
CREATE TRIGGER trigger_update_live_call_boardt_on_metric_insert
  AFTER INSERT ON agent_dial_metrics
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_live_call_boardt_on_metric();

-- Create UPDATE trigger (fires when event_type, call_status, or disposition changes)
CREATE TRIGGER trigger_update_live_call_boardt_on_metric_update
  AFTER UPDATE OF event_type, agent_email, event_timestamp, call_status, disposition, call_duration ON agent_dial_metrics
  FOR EACH ROW
  WHEN (OLD.event_type IS DISTINCT FROM NEW.event_type 
        OR OLD.agent_email IS DISTINCT FROM NEW.agent_email
        OR date_trunc('day', OLD.event_timestamp) IS DISTINCT FROM date_trunc('day', NEW.event_timestamp)
        OR OLD.call_status IS DISTINCT FROM NEW.call_status
        OR OLD.disposition IS DISTINCT FROM NEW.disposition
        OR (OLD.call_duration IS NULL AND NEW.call_duration IS NOT NULL AND NEW.call_duration > 0))
  EXECUTE FUNCTION trigger_update_live_call_boardt_on_metric();

-- ENSURE TRIGGERS ARE ENABLED (critical!)
ALTER TABLE agent_dial_metrics ENABLE TRIGGER trigger_update_live_call_boardt_on_metric_insert;
ALTER TABLE agent_dial_metrics ENABLE TRIGGER trigger_update_live_call_boardt_on_metric_update;

-- Run the function immediately to fix current stats
SELECT update_live_call_boardt_stats_from_metrics();
