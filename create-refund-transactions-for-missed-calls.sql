-- Create Refund Transactions for Missed Calls
-- This creates billing_transactions entries (refund type) for each user's missed_calls amount
-- These will show up as positive credits in their transaction history

-- Step 1: Check what will be created
SELECT 
  email,
  missed_calls,
  credits_purchased,
  'refund-missed-calls-' || email || '-' || EXTRACT(EPOCH FROM NOW())::bigint AS transaction_id_preview
FROM user_credits
WHERE missed_calls > 0
ORDER BY missed_calls DESC;

-- Step 2: Create refund transactions in billing_transactions
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
  'refund-missed-calls-' || uc.email || '-' || EXTRACT(EPOCH FROM NOW())::bigint AS transaction_id,
  'refund' AS transaction_type,
  uc.email AS agent_email,
  uc.associate_id AS agent_associate_id,
  uc.name AS agent_name,
  NOW() AS transaction_date,
  uc.missed_calls AS amount_usd,
  -uc.missed_calls AS credits_charged, -- Negative to indicate credit/refund
  NULL AS lead_name,
  NULL AS lead_phone,
  'user_credits' AS source_table,
  NULL AS source_id,
  'Refund for incorrectly charged missed calls - $' || uc.missed_calls::text || ' added to credits purchased' AS description,
  jsonb_build_object(
    'refund_reason', 'Incorrectly charged missed calls - system error',
    'original_source', 'user_credits.missed_calls',
    'applied_to_credits_purchased', true,
    'refunded_at', NOW()::text
  ) AS metadata
FROM user_credits uc
WHERE uc.missed_calls > 0
  AND NOT EXISTS (
    -- Don't create duplicate refunds
    SELECT 1 
    FROM billing_transactions bt
    WHERE bt.transaction_type = 'refund'
      AND bt.agent_email = uc.email
      AND bt.description LIKE '%Refund for incorrectly charged missed calls%'
      AND bt.transaction_date >= NOW() - INTERVAL '1 day'
  );

-- Step 3: Verify refund transactions were created
SELECT 
  COUNT(*) AS refunds_created,
  COUNT(DISTINCT agent_email) AS users_refunded,
  SUM(amount_usd) AS total_refunded
FROM billing_transactions
WHERE transaction_type = 'refund'
  AND description LIKE '%Refund for incorrectly charged missed calls%'
  AND transaction_date >= NOW() - INTERVAL '1 minute';

-- Step 4: Show sample refund transactions
SELECT 
  transaction_id,
  agent_email,
  agent_name,
  transaction_date,
  amount_usd,
  credits_charged,
  description
FROM billing_transactions
WHERE transaction_type = 'refund'
  AND description LIKE '%Refund for incorrectly charged missed calls%'
  AND transaction_date >= NOW() - INTERVAL '1 minute'
ORDER BY amount_usd DESC
LIMIT 10;

