SELECT cron.unschedule(30);
SELECT cron.unschedule(31);
SELECT jobid, jobname, active FROM cron.job WHERE jobid IN (30, 31);

