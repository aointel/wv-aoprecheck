-- Apply Missed Calls to Credits Purchased
-- Takes the missed_calls total from user_credits and adds it to credits_purchased

-- Step 1: Check current missed_calls totals in user_credits
SELECT 
  email,
  missed_calls,
  credits_purchased,
  credits_remaining,
  credits_used
FROM user_credits
WHERE missed_calls > 0
ORDER BY missed_calls DESC;

-- Step 2: Calculate total that will be applied
SELECT 
  COUNT(*) AS users_affected,
  SUM(missed_calls) AS total_to_apply,
  SUM(credits_purchased) AS current_credits_purchased,
  SUM(credits_purchased) + SUM(missed_calls) AS new_credits_purchased
FROM user_credits
WHERE missed_calls > 0;

-- Step 3: Create refund transactions in billing_transactions (run create-refund-transactions-for-missed-calls.sql first)
-- This creates the actual refund transactions that will show in transaction history

-- Step 4: Create notifications for users before applying credits
-- This notifies users that their missed calls have been reversed
INSERT INTO agent_notifications (
  agent_email,
  notification_type,
  title,
  message,
  read,
  metadata,
  created_at
)
SELECT 
  email,
  'billing_transaction' AS notification_type,
  '✅ Missed Call Charges Reversed' AS title,
  'We have reversed $' || missed_calls::text || ' in incorrectly charged missed call fees. These credits have been added to your purchased credits.' AS message,
  false AS read,
  jsonb_build_object(
    'transaction_type', 'refund',
    'amount_usd', missed_calls,
    'credits_refunded', missed_calls,
    'refund_reason', 'Incorrectly charged missed calls - system error',
    'applied_to_credits_purchased', true
  ) AS metadata,
  NOW() AS created_at
FROM user_credits
WHERE missed_calls > 0;

-- Step 5: Apply missed_calls to credits_purchased
-- This takes user_credits.missed_calls and adds it to credits_purchased
UPDATE user_credits
SET 
  credits_purchased = COALESCE(credits_purchased, 0) + COALESCE(missed_calls, 0),
  missed_calls = 0, -- Clear the missed_calls after applying
  updated_at = NOW()
WHERE missed_calls > 0;

-- Step 6: Verify the update
SELECT 
  email,
  missed_calls,
  credits_purchased,
  credits_remaining,
  credits_used,
  updated_at
FROM user_credits
WHERE updated_at >= NOW() - INTERVAL '1 minute'
ORDER BY credits_purchased DESC;

-- Step 7: Verify notifications were created
SELECT 
  COUNT(*) AS notifications_created,
  COUNT(DISTINCT agent_email) AS users_notified
FROM agent_notifications
WHERE notification_type = 'billing_transaction'
  AND title = '✅ Missed Call Charges Reversed'
  AND created_at >= NOW() - INTERVAL '1 minute';

-- Step 8: Final summary
SELECT 
  COUNT(*) AS users_updated,
  SUM(credits_purchased) AS total_credits_purchased,
  SUM(missed_calls) AS remaining_missed_calls
FROM user_credits;

