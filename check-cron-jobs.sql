-- Check Cron Jobs in Supabase/PostgreSQL
-- This queries the pg_cron extension to see all scheduled cron jobs

-- First, check if pg_cron extension is enabled
SELECT 
    extname AS extension_name,
    extversion AS version
FROM pg_extension
WHERE extname = 'pg_cron';

-- List all cron jobs
SELECT 
    jobid,
    schedule,
    command,
    nodename,
    nodeport,
    database,
    username,
    active,
    jobname
FROM cron.job
ORDER BY jobid;

-- Get detailed information about each cron job
SELECT 
    j.jobid,
    j.schedule,
    j.command,
    j.nodename,
    j.nodeport,
    j.database,
    j.username,
    j.active,
    j.jobname,
    CASE 
        WHEN j.active THEN 'ACTIVE'
        ELSE 'INACTIVE'
    END AS status
FROM cron.job j
ORDER BY j.jobid;

-- Check cron job execution history (last 50 runs)
SELECT 
    jobid,
    runid,
    job_pid,
    database,
    username,
    command,
    status,
    return_message,
    start_time,
    end_time
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 50;

-- Count cron jobs by status
SELECT 
    CASE 
        WHEN active THEN 'ACTIVE'
        ELSE 'INACTIVE'
    END AS status,
    COUNT(*) AS job_count
FROM cron.job
GROUP BY active;

-- Find cron jobs related to missed calls or billing
SELECT 
    jobid,
    schedule,
    command,
    active,
    jobname
FROM cron.job
WHERE 
    command ILIKE '%missed%call%' OR
    command ILIKE '%billing%' OR
    command ILIKE '%live_call_board%' OR
    jobname ILIKE '%missed%' OR
    jobname ILIKE '%billing%'
ORDER BY jobid;

