-- Disable Missed Call Billing
-- This SQL removes the 'missed_call' transaction type from the allowed values
-- This prevents new missed call billing transactions from being created

-- Step 1: Drop the existing CHECK constraint
ALTER TABLE billing_transactions 
DROP CONSTRAINT IF EXISTS billing_transactions_transaction_type_check;

-- Step 2: Add the new CHECK constraint WITHOUT 'missed_call'
ALTER TABLE billing_transactions
ADD CONSTRAINT billing_transactions_transaction_type_check 
CHECK (transaction_type IN ('precheck', 'recruit', 'connect', 'purchase', 'refund', 'adjustment'));

-- Verify the constraint
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'billing_transactions'::regclass
AND conname = 'billing_transactions_transaction_type_check';

-- Note: Existing 'missed_call' transactions will remain in the database
-- but new ones cannot be created after this constraint is applied

