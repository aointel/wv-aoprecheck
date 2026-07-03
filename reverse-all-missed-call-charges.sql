-- Reverse All Missed Call Charges
-- This SQL creates refund transactions for all missed_call transactions
-- and updates user credits accordingly

-- Step 1: Create refund transactions for all missed_call charges
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
  'refund-' || transaction_id || '-' || EXTRACT(EPOCH FROM NOW())::bigint AS transaction_id,
  'refund' AS transaction_type,
  agent_email,
  agent_associate_id,
  agent_name,
  NOW() AS transaction_date,
  amount_usd AS amount_usd,
  -amount_usd AS credits_charged, -- Negative to indicate refund
  lead_name,
  lead_phone,
  'billing_transactions' AS source_table,
  transaction_id AS source_id,
  'Refund for incorrectly charged missed call: ' || COALESCE(description, 'Missed call charge') AS description,
  jsonb_build_object(
    'original_transaction_id', transaction_id,
    'reversed_at', NOW()::text,
    'reversal_reason', 'Incorrectly charged - system error'
  ) AS metadata
FROM billing_transactions
WHERE transaction_type = 'missed_call'
  AND NOT EXISTS (
    SELECT 1 
    FROM billing_transactions refunds
    WHERE refunds.transaction_type = 'refund'
      AND refunds.source_id = billing_transactions.transaction_id
  );

-- Step 2: Update user credits for all affected agents
-- This adds back the credits that were charged
WITH refund_totals AS (
  SELECT 
    agent_email,
    SUM(amount_usd) AS total_refund
  FROM billing_transactions
  WHERE transaction_type = 'missed_call'
    AND agent_email IS NOT NULL
  GROUP BY agent_email
)
UPDATE user_credits uc
SET 
  credits_remaining = COALESCE(uc.credits_remaining, 0) + COALESCE(rt.total_refund, 0),
  credits_used = GREATEST(0, COALESCE(uc.credits_used, 0) - COALESCE(rt.total_refund, 0)),
  updated_at = NOW()
FROM refund_totals rt
WHERE uc.email = rt.agent_email;

-- Step 3: Verify the reversals
SELECT 
  COUNT(*) AS total_missed_call_charges,
  COUNT(DISTINCT agent_email) AS affected_agents,
  SUM(amount_usd) AS total_charged,
  (
    SELECT COUNT(*) 
    FROM billing_transactions 
    WHERE transaction_type = 'refund' 
      AND source_id IN (
        SELECT transaction_id 
        FROM billing_transactions 
        WHERE transaction_type = 'missed_call'
      )
  ) AS refunds_created,
  (
    SELECT SUM(amount_usd) 
    FROM billing_transactions 
    WHERE transaction_type = 'refund' 
      AND source_id IN (
        SELECT transaction_id 
        FROM billing_transactions 
        WHERE transaction_type = 'missed_call'
      )
  ) AS total_refunded
FROM billing_transactions
WHERE transaction_type = 'missed_call';

