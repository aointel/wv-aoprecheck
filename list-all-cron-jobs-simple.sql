-- ============================================================================
-- LIST ALL CRON JOBS (SIMPLE - RETURNS RESULTS AS TABLE)
-- ============================================================================

-- Check if pg_cron exists
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') 
    THEN '✅ pg_cron extension is available'
    ELSE '⚠️ pg_cron extension is NOT available'
  END as status;

-- List all cron jobs as a table
SELECT 
  jobid,
  COALESCE(jobname, 'unnamed') as job_name,
  schedule,
  command,
  CASE WHEN active THEN 'YES ✅' ELSE 'NO ❌' END as active,
  database,
  username
FROM cron.job
ORDER BY jobid;

