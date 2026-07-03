-- Check what Sunday PostgreSQL calculates vs what's in the database

-- What is today?
SELECT 'Today' as label, CURRENT_DATE as value;

-- What day of week is today? (0=Sunday, 1=Monday, etc.)
SELECT 'Day of Week (0=Sun)' as label, EXTRACT(DOW FROM CURRENT_DATE)::INTEGER as value;

-- What Sunday does the calculation give us?
SELECT 
  'Calculated Sunday (week_start)' as label,
  (CURRENT_DATE - (EXTRACT(DOW FROM CURRENT_DATE)::INTEGER))::DATE as value;

-- What's in the database?
SELECT 
  'Records in weekly_usage_stats' as label,
  COUNT(*) as count
FROM weekly_usage_stats;

-- Show all records with their week_start_date
SELECT 
  agent_email,
  week_start_date,
  week_end_date,
  total_logins,
  total_dials_made,
  sales_made,
  total_alp
FROM weekly_usage_stats
ORDER BY week_start_date DESC;

-- Check if there's data for the calculated Sunday
SELECT 
  'Matching Current Week' as label,
  COUNT(*) as count
FROM weekly_usage_stats
WHERE week_start_date = (CURRENT_DATE - (EXTRACT(DOW FROM CURRENT_DATE)::INTEGER))::DATE;

