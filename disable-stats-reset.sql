-- ============================================================================
-- DISABLE STATS RESET IN UPDATE FUNCTION
-- 
-- This removes the aggressive reset logic that sets stats to 0 for agents
-- with no metrics today. This prevents stats from being cleared incorrectly.
-- ============================================================================

-- Update the bulk update function to NOT reset stats to 0
CREATE OR REPLACE FUNCTION update_live_call_board_stats_from_metrics()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  today_start timestamptz;
  today_end timestamptz;
BEGIN
  -- Get today's date range in PST timezone, then convert to UTC for querying
  today_start := date_trunc('day', (now() AT TIME ZONE 'America/Los_Angeles')::timestamp) AT TIME ZONE 'America/Los_Angeles';
  today_end := today_start + interval '1 day';
  
  -- Update live_call_board with today's stats from agent_dial_metrics
  -- CRITICAL: Each phone number counts ONCE per agent per day (even if dialed/reached/booked multiple times)
  -- Using INSERT ... ON CONFLICT to update existing rows or insert new ones
  INSERT INTO live_call_board (
    agent_email,
    status,
    today_dialed,
    today_reached,
    today_booked,
    updated_at
  )
  SELECT 
    agent_email,
    'offline' as status,  -- Default status for new rows
    COUNT(DISTINCT dial_phones.lead_phone) as dialed,
    COUNT(DISTINCT reach_phones.lead_phone) as reached,
    COUNT(DISTINCT booked_phones.lead_phone) as booked,
    now() as updated_at
  FROM (
    SELECT DISTINCT agent_email
    FROM agent_dial_metrics
    WHERE event_timestamp >= today_start
      AND event_timestamp < today_end
      AND agent_email IS NOT NULL
      AND agent_email != ''
      AND lead_phone IS NOT NULL
  ) stats
  LEFT JOIN LATERAL (
    SELECT DISTINCT lead_phone
    FROM agent_dial_metrics
    WHERE agent_email = stats.agent_email 
      AND event_type = 'dial'
      AND event_timestamp >= today_start 
      AND event_timestamp < today_end
      AND lead_phone IS NOT NULL
  ) dial_phones ON true
  LEFT JOIN LATERAL (
    SELECT DISTINCT lead_phone
    FROM agent_dial_metrics
    WHERE agent_email = stats.agent_email 
      AND event_type = 'reach'
      AND event_timestamp >= today_start 
      AND event_timestamp < today_end
      AND lead_phone IS NOT NULL
  ) reach_phones ON true
  LEFT JOIN LATERAL (
    SELECT DISTINCT lead_phone
    FROM agent_dial_metrics
    WHERE agent_email = stats.agent_email 
      AND (event_type = 'booked' OR LOWER(disposition) = 'booked')
      AND event_timestamp >= today_start 
      AND event_timestamp < today_end
      AND lead_phone IS NOT NULL
  ) booked_phones ON true
  GROUP BY agent_email
  ON CONFLICT (agent_email) 
  DO UPDATE SET
    today_dialed = EXCLUDED.today_dialed,
    today_reached = EXCLUDED.today_reached,
    today_booked = EXCLUDED.today_booked,
    updated_at = EXCLUDED.updated_at;
  
  -- REMOVED: The aggressive reset logic that was clearing stats to 0
  -- This was causing stats to be reset incorrectly
  -- Stats will only be updated for agents who have metrics today
  -- Agents without metrics today will keep their existing stats (won't be reset to 0)
  
END;
$$;

RAISE NOTICE '✅ Updated function to prevent stats reset - stats will only update for agents with metrics today';

