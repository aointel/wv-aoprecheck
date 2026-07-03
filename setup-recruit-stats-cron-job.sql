-- Setup cron job to periodically update live_call_boardt_recruit stats
-- Runs every 5 minutes to keep recruit stats up to date

-- First, ensure pg_cron extension is enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove existing cron job if it exists
SELECT cron.unschedule('update-recruit-stats-all');

-- Schedule job to update all recruit stats every 5 minutes
SELECT cron.schedule(
  'update-recruit-stats-all',
  '*/5 * * * *', -- Every 5 minutes
  $$SELECT update_live_call_boardt_recruit_stats_all()$$
);

-- Schedule job to update recruit connects every 5 minutes
SELECT cron.unschedule('update-recruit-connects');
SELECT cron.schedule(
  'update-recruit-connects',
  '*/5 * * * *', -- Every 5 minutes
  $$SELECT update_live_call_boardt_recruit_connects()$$
);

-- Verify cron jobs are scheduled
SELECT 
  jobid,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active
FROM cron.job
WHERE jobname IN ('update-recruit-stats-all', 'update-recruit-connects');
