-- ============================================================================
-- REACH EVENTS PER HOUR PER AGENT
-- Scans agent_dial_metrics on Supabase and counts how many reach events
-- occur per hour per agent. Uses ALL data in the table.
-- ============================================================================
-- Run this in Supabase SQL Editor

-- Option 1: Reach events per hour per agent (all time, UTC)
-- Groups by agent_email and hour (event_timestamp truncated to hour)
SELECT
  agent_email,
  date_trunc('hour', event_timestamp AT TIME ZONE 'UTC') AS hour_utc,
  COUNT(*) AS reach_count,
  COUNT(DISTINCT lead_phone) AS unique_phones_reached
FROM agent_dial_metrics
WHERE LOWER(event_type) = 'reach'
GROUP BY agent_email, date_trunc('hour', event_timestamp AT TIME ZONE 'UTC')
ORDER BY agent_email, hour_utc;


-- Option 2: Reach events per hour per agent in Eastern time (common for US agents)
SELECT
  agent_email,
  date_trunc('hour', event_timestamp AT TIME ZONE 'America/New_York') AS hour_eastern,
  COUNT(*) AS reach_count,
  COUNT(DISTINCT lead_phone) AS unique_phones_reached
FROM agent_dial_metrics
WHERE LOWER(event_type) = 'reach'
GROUP BY agent_email, date_trunc('hour', event_timestamp AT TIME ZONE 'America/New_York')
ORDER BY agent_email, hour_eastern;


-- Option 3: Summary per agent - total reach events, avg per hour (when active), peak hour
WITH hourly AS (
  SELECT
    agent_email,
    date_trunc('hour', event_timestamp AT TIME ZONE 'America/New_York') AS hour_eastern,
    COUNT(*) AS reach_count
  FROM agent_dial_metrics
  WHERE LOWER(event_type) = 'reach'
  GROUP BY agent_email, date_trunc('hour', event_timestamp AT TIME ZONE 'America/New_York')
)
SELECT
  agent_email,
  SUM(reach_count) AS total_reach_events,
  COUNT(*) AS hours_with_activity,
  ROUND(AVG(reach_count)::numeric, 2) AS avg_reach_per_hour_when_active,
  MAX(reach_count) AS max_reach_in_single_hour,
  MIN(hour_eastern) AS first_activity_hour,
  MAX(hour_eastern) AS last_activity_hour
FROM hourly
GROUP BY agent_email
ORDER BY total_reach_events DESC;


-- Option 4: Heatmap-style - reach count per hour-of-day (0-23) per agent
-- Useful for seeing which hours of the day each agent is most active
SELECT
  agent_email,
  EXTRACT(HOUR FROM (event_timestamp AT TIME ZONE 'America/New_York'))::integer AS hour_of_day_eastern,
  COUNT(*) AS reach_count,
  COUNT(DISTINCT lead_phone) AS unique_phones
FROM agent_dial_metrics
WHERE LOWER(event_type) = 'reach'
GROUP BY agent_email, EXTRACT(HOUR FROM (event_timestamp AT TIME ZONE 'America/New_York'))
ORDER BY agent_email, hour_of_day_eastern;


-- Option 5: Per-agent hourly breakdown with date (all data, human-readable)
SELECT
  agent_email,
  TO_CHAR((event_timestamp AT TIME ZONE 'America/New_York'), 'YYYY-MM-DD') AS date_eastern,
  EXTRACT(HOUR FROM (event_timestamp AT TIME ZONE 'America/New_York'))::integer AS hour_eastern,
  COUNT(*) AS reach_count
FROM agent_dial_metrics
WHERE LOWER(event_type) = 'reach'
GROUP BY
  agent_email,
  TO_CHAR((event_timestamp AT TIME ZONE 'America/New_York'), 'YYYY-MM-DD'),
  EXTRACT(HOUR FROM (event_timestamp AT TIME ZONE 'America/New_York'))
ORDER BY agent_email, date_eastern, hour_eastern;
