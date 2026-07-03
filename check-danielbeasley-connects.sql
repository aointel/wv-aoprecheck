-- Check danielbeasley connects vs missed calls
-- This will show what's actually in the database

-- Check billing_transactions for danielbeasley
SELECT 
  'billing_transactions' as source,
  transaction_type,
  COUNT(*) as count,
  MIN(transaction_date) as earliest,
  MAX(transaction_date) as latest
FROM billing_transactions
WHERE LOWER(agent_email) LIKE '%danielbeasley%'
  OR LOWER(agent_email) LIKE '%beasley%'
GROUP BY transaction_type
ORDER BY transaction_type;

-- Show actual transactions
SELECT 
  transaction_id,
  transaction_type,
  agent_email,
  transaction_date,
  lead_name,
  lead_phone,
  amount_usd,
  credits_charged
FROM billing_transactions
WHERE LOWER(agent_email) LIKE '%danielbeasley%'
  OR LOWER(agent_email) LIKE '%beasley%'
ORDER BY transaction_date DESC
LIMIT 50;

-- Check vdp_calls for danielbeasley
SELECT 
  'vdp_calls' as source,
  COUNT(*) as total_calls,
  COUNT(CASE WHEN company_email IS NOT NULL THEN 1 END) as calls_with_email
FROM vdp_calls
WHERE LOWER(company_email) LIKE '%danielbeasley%'
  OR LOWER(company_email) LIKE '%beasley%';

-- Check weekly_usage_stats
SELECT 
  agent_email,
  week_start_date,
  vdp_connects_received,
  vdp_total_minutes,
  vdp_available_minutes,
  vdp_call_minutes
FROM weekly_usage_stats
WHERE LOWER(agent_email) LIKE '%danielbeasley%'
  OR LOWER(agent_email) LIKE '%beasley%'
ORDER BY week_start_date DESC;

-- Check if there are any numeric emails that map to danielbeasley
SELECT 
  associate_id,
  company_email,
  personal_email
FROM customers
WHERE LOWER(company_email) LIKE '%danielbeasley%'
  OR LOWER(personal_email) LIKE '%danielbeasley%'
  OR LOWER(company_email) LIKE '%beasley%'
  OR LOWER(personal_email) LIKE '%beasley%';
