-- Notify Users About Missed Call Refunds
-- Creates notifications for users who received refunds for missed calls

-- Step 1: Check what refund transactions exist
SELECT 
  bt.transaction_id,
  bt.agent_email,
  bt.amount_usd AS refund_amount,
  bt.credits_charged,
  bt.description,
  bt.transaction_date AS refund_date
FROM billing_transactions bt
WHERE bt.transaction_type = 'refund'
  AND bt.agent_email IS NOT NULL
ORDER BY bt.transaction_date DESC
LIMIT 20;

-- Step 2: Check refunds related to missed calls (by source_id or description)
SELECT 
  bt.transaction_id,
  bt.agent_email,
  bt.amount_usd AS refund_amount,
  bt.description,
  bt.source_id,
  bt.transaction_date
FROM billing_transactions bt
WHERE bt.transaction_type = 'refund'
  AND bt.agent_email IS NOT NULL
  AND (
    bt.description LIKE '%missed%call%' 
    OR bt.description LIKE '%Missed%Call%'
    OR bt.source_id::text IN (
      SELECT transaction_id::text 
      FROM billing_transactions 
      WHERE transaction_type = 'missed_call'
    )
  )
ORDER BY bt.transaction_date DESC;

-- Step 3: Create notifications for ALL refund transactions (they're all missed call refunds)
INSERT INTO agent_notifications (
  agent_email,
  notification_type,
  title,
  message,
  read,
  metadata,
  created_at
)
SELECT DISTINCT ON (bt.agent_email)
  bt.agent_email,
  'billing_transaction' AS notification_type,
  '✅ Missed Call Charges Reversed' AS title,
  'We have reversed $' || bt.amount_usd::text || ' in incorrectly charged missed call fees. These credits have been added to your purchased credits.' AS message,
  false AS read,
  jsonb_build_object(
    'transaction_type', 'refund',
    'transaction_id', bt.transaction_id,
    'amount_usd', bt.amount_usd,
    'credits_refunded', ABS(bt.credits_charged),
    'refund_reason', 'Incorrectly charged missed calls - system error',
    'applied_to_credits_purchased', true,
    'refund_date', bt.transaction_date::text
  ) AS metadata,
  NOW() AS created_at
FROM billing_transactions bt
WHERE bt.transaction_type = 'refund'
  AND bt.agent_email IS NOT NULL
  AND NOT EXISTS (
    -- Don't create duplicate notifications for this user
    SELECT 1 
    FROM agent_notifications an
    WHERE an.agent_email = bt.agent_email
      AND an.title = '✅ Missed Call Charges Reversed'
      AND an.created_at >= NOW() - INTERVAL '1 day'
  )
ORDER BY bt.agent_email, bt.transaction_date DESC;

-- Step 4: Verify notifications were created
SELECT 
  COUNT(*) AS notifications_created,
  COUNT(DISTINCT agent_email) AS users_notified,
  SUM((metadata->>'amount_usd')::numeric) AS total_refunded
FROM agent_notifications
WHERE notification_type = 'billing_transaction'
  AND title = '✅ Missed Call Charges Reversed'
  AND created_at >= NOW() - INTERVAL '1 minute';

-- Step 5: Show sample notifications created
SELECT 
  agent_email,
  title,
  message,
  created_at
FROM agent_notifications
WHERE notification_type = 'billing_transaction'
  AND title = '✅ Missed Call Charges Reversed'
  AND created_at >= NOW() - INTERVAL '1 minute'
ORDER BY created_at DESC
LIMIT 10;

