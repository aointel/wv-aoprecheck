-- Backfill CCPRO flag in customers table based on existing Stripe subscriptions
-- This syncs the customers.CCPRO column with connectnow_subscriptions data

-- Step 1: Update CCPRO = true for users with active/trialing professional or elite subscriptions
UPDATE customers
SET "CCPRO" = true
WHERE company_email IN (
  SELECT user_email
  FROM connectnow_subscriptions
  WHERE (status = 'active' OR status = 'trialing')
    AND (plan = 'professional' OR plan = 'elite')
);

-- Step 2: Update CCPRO = false for ALL other users who have subscription records
-- This includes: starter plan users, inactive/canceled users, etc.
UPDATE customers
SET "CCPRO" = false
WHERE company_email IN (
  SELECT user_email
  FROM connectnow_subscriptions
  WHERE NOT (
    (status = 'active' OR status = 'trialing')
    AND (plan = 'professional' OR plan = 'elite')
  )
);

-- Step 3: Also set CCPRO = false for any customers with NULL CCPRO that don't have a subscription record
-- (This handles edge cases where customer exists but no subscription record)
UPDATE customers
SET "CCPRO" = false
WHERE "CCPRO" IS NULL
  AND company_email NOT IN (
    SELECT user_email FROM connectnow_subscriptions
  );

-- Show summary of updates
SELECT 
  'CCPRO Enabled' as status,
  COUNT(*) as count
FROM customers
WHERE "CCPRO" = true

UNION ALL

SELECT 
  'CCPRO Disabled' as status,
  COUNT(*) as count
FROM customers
WHERE "CCPRO" = false OR "CCPRO" IS NULL;

-- Show detailed breakdown by subscription status
SELECT 
  cs.user_email,
  cs.plan,
  cs.status,
  c."CCPRO" as ccpro_flag,
  CASE 
    WHEN (cs.status = 'active' OR cs.status = 'trialing') 
         AND (cs.plan = 'professional' OR cs.plan = 'elite') 
    THEN 'Should be TRUE'
    ELSE 'Should be FALSE'
  END as expected_flag
FROM connectnow_subscriptions cs
LEFT JOIN customers c ON c.company_email = cs.user_email
ORDER BY cs.user_email;

