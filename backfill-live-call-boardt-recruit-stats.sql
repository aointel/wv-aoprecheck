-- Backfill live_call_boardt_recruit with historical data
-- This initializes the table with all existing recruit metrics
-- RECRUIT STATS COME FROM recruit_candidates table (each candidate = 1 connect)

-- Step 1: Initialize table with all agents who have recruit candidates TODAY
-- Each candidate in recruit_candidates = 1 connect
-- Use a subquery to aggregate first, ensuring one row per agent_email
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
  rc_agg.agent_email,
  rc_agg.agent_name,
  'offline' as status,
  0 as dialed, -- Dialed comes from agent_dial_metrics
  0 as reached, -- Reached comes from agent_dial_metrics
  0 as booked, -- Booked comes from agent_dial_metrics
  rc_agg.connects, -- Each recruit_candidate = 1 connect
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
  WHERE rc.created_at >= date_trunc('day', (now() AT TIME ZONE 'America/Los_Angeles')::timestamp) AT TIME ZONE 'America/Los_Angeles'
    AND rc.created_at < date_trunc('day', (now() AT TIME ZONE 'America/Los_Angeles')::timestamp) AT TIME ZONE 'America/Los_Angeles' + interval '1 day'
    AND rc.agent_email IS NOT NULL
    AND rc.agent_email != ''
  GROUP BY rc.agent_email
) rc_agg
ON CONFLICT (agent_email) 
DO UPDATE SET
  today_connects = EXCLUDED.today_connects,
  agent_name = COALESCE(EXCLUDED.agent_name, live_call_boardt_recruit.agent_name),
  updated_at = EXCLUDED.updated_at;

-- Step 2: Get dialed/reached/booked from agent_dial_metrics (if available)
-- These are separate from connects (which come from recruit_candidates)
UPDATE live_call_boardt_recruit lcb
SET 
  today_dialed = (
    SELECT COUNT(DISTINCT lead_phone)
    FROM agent_dial_metrics
    WHERE agent_email = lcb.agent_email
      AND LOWER(COALESCE(source, '')) = 'outbound_dialer_recruit'
      AND LOWER(event_type) = 'dial'
      AND event_timestamp >= date_trunc('day', (now() AT TIME ZONE 'America/Los_Angeles')::timestamp) AT TIME ZONE 'America/Los_Angeles'
      AND event_timestamp < date_trunc('day', (now() AT TIME ZONE 'America/Los_Angeles')::timestamp) AT TIME ZONE 'America/Los_Angeles' + interval '1 day'
      AND lead_phone IS NOT NULL
  ),
  today_reached = (
    SELECT COUNT(DISTINCT lead_phone)
    FROM agent_dial_metrics
    WHERE agent_email = lcb.agent_email
      AND LOWER(COALESCE(source, '')) = 'outbound_dialer_recruit'
      AND LOWER(event_type) = 'reach'
      AND LOWER(COALESCE(call_status, '')) IN ('answered', 'completed')
      AND event_timestamp >= date_trunc('day', (now() AT TIME ZONE 'America/Los_Angeles')::timestamp) AT TIME ZONE 'America/Los_Angeles'
      AND event_timestamp < date_trunc('day', (now() AT TIME ZONE 'America/Los_Angeles')::timestamp) AT TIME ZONE 'America/Los_Angeles' + interval '1 day'
      AND lead_phone IS NOT NULL
  ),
  today_booked = (
    SELECT COUNT(DISTINCT lead_phone)
    FROM agent_dial_metrics
    WHERE agent_email = lcb.agent_email
      AND LOWER(COALESCE(source, '')) = 'outbound_dialer_recruit'
      AND (LOWER(event_type) = 'booked' OR LOWER(COALESCE(disposition, '')) = 'booked')
      AND event_timestamp >= date_trunc('day', (now() AT TIME ZONE 'America/Los_Angeles')::timestamp) AT TIME ZONE 'America/Los_Angeles'
      AND event_timestamp < date_trunc('day', (now() AT TIME ZONE 'America/Los_Angeles')::timestamp) AT TIME ZONE 'America/Los_Angeles' + interval '1 day'
      AND lead_phone IS NOT NULL
  ),
  updated_at = now()
WHERE EXISTS (
  SELECT 1 FROM live_call_boardt_recruit lcb2 WHERE lcb2.agent_email = lcb.agent_email
);

-- Step 3: Add agents with dial/reach/booked but no candidates yet
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
  0 as connects, -- No candidate = no connect
  now() as updated_at
FROM (
  SELECT 
    adm.agent_email,
    COALESCE(lcb.agent_name, ah.agent_name, adm.agent_email) as agent_name,
    COUNT(DISTINCT CASE WHEN LOWER(adm.event_type) = 'dial' THEN adm.lead_phone END) as dialed,
    COUNT(DISTINCT CASE 
      WHEN LOWER(adm.event_type) = 'reach' 
        AND LOWER(COALESCE(adm.call_status, '')) IN ('answered', 'completed')
        AND adm.lead_phone IS NOT NULL
      THEN adm.lead_phone 
    END) as reached,
    COUNT(DISTINCT CASE 
      WHEN (LOWER(adm.event_type) = 'booked' OR LOWER(COALESCE(adm.disposition, '')) = 'booked')
        AND adm.lead_phone IS NOT NULL
      THEN adm.lead_phone 
    END) as booked
  FROM agent_dial_metrics adm
  LEFT JOIN live_call_boardt lcb ON lcb.agent_email = adm.agent_email
  LEFT JOIN agent_hierarchy ah ON ah.agent_email = adm.agent_email
  WHERE LOWER(COALESCE(adm.source, '')) = 'outbound_dialer_recruit'
    AND adm.event_timestamp >= date_trunc('day', (now() AT TIME ZONE 'America/Los_Angeles')::timestamp) AT TIME ZONE 'America/Los_Angeles'
    AND adm.event_timestamp < date_trunc('day', (now() AT TIME ZONE 'America/Los_Angeles')::timestamp) AT TIME ZONE 'America/Los_Angeles' + interval '1 day'
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

-- Step 4: Show summary
SELECT 
  COUNT(*) as total_agents,
  SUM(today_dialed) as total_dialed,
  SUM(today_reached) as total_reached,
  SUM(today_booked) as total_booked,
  SUM(today_connects) as total_connects
FROM live_call_boardt_recruit;
