-- Verify Missed Calls Match User Credits
-- Compare billing_transactions missed_call totals with user_credits.missed_calls

-- Step 1: Total from billing_transactions (last 10 days)
SELECT 
  'billing_transactions' AS source,
  COUNT(*) AS transaction_count,
  SUM(amount_usd) AS total_amount,
  COUNT(DISTINCT agent_email) AS unique_agents
FROM billing_transactions
WHERE transaction_type = 'missed_call'
  AND transaction_date >= NOW() - INTERVAL '10 days';

-- Step 2: Total from user_credits.missed_calls
SELECT 
  'user_credits' AS source,
  COUNT(*) AS users_with_missed_calls,
  SUM(missed_calls) AS total_missed_calls,
  COUNT(DISTINCT email) AS unique_users
FROM user_credits
WHERE missed_calls > 0;

-- Step 3: Compare by agent/email
SELECT 
  COALESCE(bt.agent_email, uc.email) AS email,
  COALESCE(SUM(bt.amount_usd), 0) AS billing_transactions_total,
  COALESCE(uc.missed_calls, 0) AS user_credits_missed_calls,
  COALESCE(SUM(bt.amount_usd), 0) - COALESCE(uc.missed_calls, 0) AS difference
FROM billing_transactions bt
FULL OUTER JOIN user_credits uc ON bt.agent_email = uc.email
WHERE (bt.transaction_type = 'missed_call' AND bt.transaction_date >= NOW() - INTERVAL '10 days')
   OR uc.missed_calls > 0
GROUP BY COALESCE(bt.agent_email, uc.email), uc.missed_calls
HAVING COALESCE(SUM(bt.amount_usd), 0) != COALESCE(uc.missed_calls, 0)
ORDER BY ABS(COALESCE(SUM(bt.amount_usd), 0) - COALESCE(uc.missed_calls, 0)) DESC;

