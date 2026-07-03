-- Optional: Archive/delete old call data to reduce table size (7M+ rows causes performance issues)
-- Run manually in Supabase. Adjust days as needed.
-- WARNING: This DELETES data. Backup first if needed.

-- Option 1: Delete twilio_call_logs older than 90 days (keeps recent for analysis)
-- DELETE FROM twilio_call_logs WHERE call_started_at < NOW() - INTERVAL '90 days';

-- Option 2: Delete taalk_call_analytics older than 90 days
-- DELETE FROM taalk_call_analytics WHERE call_date < NOW() - INTERVAL '90 days';

-- Check row counts first:
-- SELECT 'twilio_call_logs' AS tbl, COUNT(*) FROM twilio_call_logs
-- UNION ALL
-- SELECT 'taalk_call_analytics', COUNT(*) FROM taalk_call_analytics;
