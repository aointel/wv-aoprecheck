-- Create Credit Entries (Refunds) for All Missed Call Charges (Last 10 Days)
-- This unwinds all missed_call transactions by creating refund transactions

-- Step 1: Check how many missed_call transactions exist from last 10 days
SELECT 
  COUNT(*) AS total_missed_calls,
  COUNT(DISTINCT agent_email) AS affected_agents,
  SUM(amount_usd) AS total_charged,
  MIN(transaction_date) AS earliest_date,
  MAX(transaction_date) AS latest_date
FROM billing_transactions
WHERE transaction_type = 'missed_call'
  AND transaction_date >= NOW() - INTERVAL '10 days';

-- Step 2: Check which ones already have refunds
SELECT 
  COUNT(*) AS already_refunded
FROM billing_transactions bt
WHERE bt.transaction_type = 'missed_call'
  AND bt.transaction_date >= NOW() - INTERVAL '10 days'
  AND EXISTS (
    SELECT 1 
    FROM billing_transactions refunds
    WHERE refunds.transaction_type = 'refund'
      AND refunds.source_id = bt.transaction_id
  );

-- Step 3: Create refund transactions for all missed_call charges (last 10 days)
-- that don't already have refunds
INSERT INTO billing_transactions (
  transaction_id,
  transaction_type,
  agent_email,
  agent_associate_id,
  agent_name,
  transaction_date,
  amount_usd,
  credits_charged,
  lead_name,
  lead_phone,
  source_table,
  source_id,
  description,
  metadata
)
SELECT 
  'refund-' || bt.transaction_id || '-' || EXTRACT(EPOCH FROM NOW())::bigint AS transaction_id,
  'refund' AS transaction_type,
  bt.agent_email,
  bt.agent_associate_id,
  bt.agent_name,
  NOW() AS transaction_date,
  bt.amount_usd AS amount_usd,
  -bt.amount_usd AS credits_charged, -- Negative to indicate credit/refund
  bt.lead_name,
  bt.lead_phone,
  'billing_transactions' AS source_table,
  bt.transaction_id AS source_id,
  'Refund for incorrectly charged missed call: ' || COALESCE(bt.description, 'Missed call charge') AS description,
  jsonb_build_object(
    'original_transaction_id', bt.transaction_id,
    'reversed_at', NOW()::text,
    'reversal_reason', 'Incorrectly charged - system error',
    'original_transaction_date', bt.transaction_date::text
  ) AS metadata
FROM billing_transactions bt
WHERE bt.transaction_type = 'missed_call'
  AND bt.transaction_date >= NOW() - INTERVAL '10 days'
  AND bt.agent_email IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 
    FROM billing_transactions refunds
    WHERE refunds.transaction_type = 'refund'
      AND refunds.source_id = bt.transaction_id
  );

-- Step 4: Verify the refunds were created
SELECT 
  COUNT(*) AS refunds_created,
  COUNT(DISTINCT agent_email) AS agents_refunded,
  SUM(amount_usd) AS total_refunded
FROM billing_transactions
WHERE transaction_type = 'refund'
  AND transaction_date >= NOW() - INTERVAL '1 hour'
  AND source_id IN (
    SELECT transaction_id 
    FROM billing_transactions 
    WHERE transaction_type = 'missed_call'
      AND transaction_date >= NOW() - INTERVAL '10 days'
  );

-- Step 5: Show summary of all missed calls and their refunds
SELECT 
  bt.transaction_id AS missed_call_id,
  bt.agent_email,
  bt.agent_name,
  bt.transaction_date AS charged_date,
  bt.amount_usd AS charged_amount,
  CASE 
    WHEN r.transaction_id IS NOT NULL THEN '✅ Refunded'
    ELSE '❌ Not Refunded'
  END AS refund_status,
  r.transaction_date AS refunded_date,
  r.amount_usd AS refunded_amount
FROM billing_transactions bt
LEFT JOIN billing_transactions r ON r.transaction_type = 'refund' AND r.source_id = bt.transaction_id
WHERE bt.transaction_type = 'missed_call'
  AND bt.transaction_date >= NOW() - INTERVAL '10 days'
ORDER BY bt.transaction_date DESC;

