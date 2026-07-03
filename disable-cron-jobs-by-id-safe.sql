-- Safely Disable Cron Jobs by ID
-- This uses UPDATE instead of unschedule to avoid errors

-- Disable specific jobs by ID (set active = false)
DO $$
DECLARE
  job_ids integer[] := ARRAY[30, 31]; -- Add more job IDs here if needed
  job_id integer;
  updated_count integer;
BEGIN
  FOREACH job_id IN ARRAY job_ids
  LOOP
    -- Check if job exists before trying to update
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobid = job_id) THEN
      UPDATE cron.job
      SET active = false
      WHERE jobid = job_id;
      
      GET DIAGNOSTICS updated_count = ROW_COUNT;
      
      IF updated_count > 0 THEN
        RAISE NOTICE '✅ Disabled job ID %', job_id;
      ELSE
        RAISE NOTICE '⚠️  Job ID % exists but was already disabled', job_id;
      END IF;
    ELSE
      RAISE NOTICE '⚠️  Job ID % does not exist', job_id;
    END IF;
  END LOOP;
END $$;

-- Verify the jobs are disabled
SELECT 
  jobid,
  COALESCE(jobname, 'unnamed') as job_name,
  schedule,
  CASE WHEN active THEN 'YES ✅' ELSE 'NO ❌' END as active,
  LEFT(command, 100) as command_preview
FROM cron.job
WHERE jobid IN (30, 31)
ORDER BY jobid;

