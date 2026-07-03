-- Fix ALL PreCheck and Recruit transactions to be FREE (all dates)
-- PreCheck and AO Recruit are now free services

-- Update ALL precheck and recruit transactions to $0.00 and 0 credits
UPDATE billing_transactions 
SET 
  amount_usd = 0.00,
  credits_charged = 0,
  notes = COALESCE(notes || ' | ', '') || 'Set to free - all precheck/recruit transactions are free',
  updated_at = NOW()
WHERE 
  transaction_type IN ('precheck', 'recruit')
  AND (amount_usd > 0 OR credits_charged > 0);

-- Show summary of what was updated
SELECT 
  transaction_type,
  COUNT(*) as total_transactions,
  SUM(amount_usd) as total_amount,
  SUM(credits_charged) as total_credits,
  MIN(transaction_date) as earliest_date,
  MAX(transaction_date) as latest_date
FROM billing_transactions 
WHERE transaction_type IN ('precheck', 'recruit')
GROUP BY transaction_type;

-- Verify a sample of updated transactions
SELECT 
  id,
  transaction_type,
  lead_name,
  lead_phone,
  amount_usd,
  credits_charged,
  transaction_date,
  notes
FROM billing_transactions 
WHERE transaction_type IN ('precheck', 'recruit')
ORDER BY transaction_date DESC
LIMIT 20;

