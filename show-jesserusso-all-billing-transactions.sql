-- Show ALL billing transactions for jesserusso@aoglobelife.com

-- Get all billing transactions
SELECT 
  id,
  transaction_id,
  transaction_type,
  agent_email,
  agent_associate_id,
  transaction_date,
  amount_usd,
  credits_charged,
  lead_name,
  lead_phone,
  source_table,
  source_id,
  description,
  status,
  created_at,
  updated_at
FROM billing_transactions
WHERE agent_email = 'jesserusso@aoglobelife.com'
ORDER BY transaction_date DESC;

-- Summary by transaction type
SELECT 
  transaction_type,
  COUNT(*) as count,
  SUM(credits_charged) as total_credits,
  SUM(amount_usd::numeric) as total_amount,
  MIN(transaction_date) as earliest,
  MAX(transaction_date) as latest
FROM billing_transactions
WHERE agent_email = 'jesserusso@aoglobelife.com'
GROUP BY transaction_type
ORDER BY transaction_type;

-- Total summary
SELECT 
  COUNT(*) as total_transactions,
  SUM(credits_charged) as total_credits_charged,
  SUM(amount_usd::numeric) as total_amount_usd,
  MIN(transaction_date) as first_transaction,
  MAX(transaction_date) as last_transaction
FROM billing_transactions
WHERE agent_email = 'jesserusso@aoglobelife.com';
