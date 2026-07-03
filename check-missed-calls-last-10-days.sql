-- Check Missed Call Transactions from Last 10 Days
-- Run this first to see what will be refunded

-- Summary of missed calls
SELECT 
  COUNT(*) AS total_missed_calls,
  COUNT(DISTINCT agent_email) AS affected_agents,
  SUM(amount_usd) AS total_charged,
  MIN(transaction_date) AS earliest_date,
  MAX(transaction_date) AS latest_date
FROM billing_transactions
WHERE transaction_type = 'missed_call'
  AND transaction_date >= NOW() - INTERVAL '10 days';

-- List all missed call transactions
SELECT 
  transaction_id,
  agent_email,
  agent_name,
  transaction_date,
  amount_usd,
  credits_charged,
  lead_name,
  lead_phone,
  description,
  CASE 
    WHEN EXISTS (
      SELECT 1 
      FROM billing_transactions refunds
      WHERE refunds.transaction_type = 'refund'
        AND refunds.source_id = billing_transactions.transaction_id
    ) THEN '✅ Already Refunded'
    ELSE '❌ Needs Refund'
  END AS refund_status
FROM billing_transactions
WHERE transaction_type = 'missed_call'
  AND transaction_date >= NOW() - INTERVAL '10 days'
ORDER BY transaction_date DESC;

-- Count how many need refunds
SELECT 
  COUNT(*) AS needs_refund
FROM billing_transactions bt
WHERE bt.transaction_type = 'missed_call'
  AND bt.transaction_date >= NOW() - INTERVAL '10 days'
  AND NOT EXISTS (
    SELECT 1 
    FROM billing_transactions refunds
    WHERE refunds.transaction_type = 'refund'
      AND refunds.source_id = bt.transaction_id
  );

