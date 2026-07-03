-- Add 'missed_call' as a valid transaction_type for billing_transactions
-- The current CHECK constraint only allows: precheck, recruit, connect, purchase, refund, adjustment

-- Step 1: Drop the existing CHECK constraint
ALTER TABLE billing_transactions 
DROP CONSTRAINT IF EXISTS billing_transactions_transaction_type_check;

-- Step 2: Add the new CHECK constraint with 'missed_call' included
ALTER TABLE billing_transactions
ADD CONSTRAINT billing_transactions_transaction_type_check 
CHECK (transaction_type IN ('precheck', 'recruit', 'connect', 'purchase', 'refund', 'adjustment', 'missed_call'));

-- Verify the constraint
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'billing_transactions'::regclass
AND conname = 'billing_transactions_transaction_type_check';

