-- Show danielbeasley's connects for TODAY
-- This will show exactly what transactions are being counted as connects

-- Get today's date range (EST timezone - adjust if needed)
WITH today_range AS (
  SELECT 
    CURRENT_DATE as today_start,
    CURRENT_DATE + INTERVAL '1 day' as today_end
)
SELECT 
  bt.transaction_id,
  bt.transaction_type,
  bt.agent_email,
  bt.transaction_date,
  bt.lead_name,
  bt.lead_phone,
  bt.amount_usd,
  bt.credits_charged,
  bt.source_table,
  bt.source_id,
  bt.description,
  bt.metadata
FROM billing_transactions bt, today_range tr
WHERE bt.transaction_type = 'connect'
  AND (LOWER(bt.agent_email) LIKE '%danielbeasley%' OR LOWER(bt.agent_email) LIKE '%beasley%')
  AND bt.transaction_date >= tr.today_start
  AND bt.transaction_date < tr.today_end
ORDER BY bt.transaction_date DESC;

-- Also check vdp_calls for today
WITH today_range AS (
  SELECT 
    CURRENT_DATE as today_start,
    CURRENT_DATE + INTERVAL '1 day' as today_end
)
SELECT 
  vc.id,
  vc.company_email,
  vc.phone,
  vc.first_name,
  vc.last_name,
  vc.updated_at,
  vc.time,
  vc.market
FROM vdp_calls vc, today_range tr
WHERE (LOWER(vc.company_email) LIKE '%danielbeasley%' OR LOWER(vc.company_email) LIKE '%beasley%')
  AND vc.updated_at >= tr.today_start
  AND vc.updated_at < tr.today_end
ORDER BY vc.updated_at DESC;

-- Summary count
SELECT 
  'billing_transactions' as source,
  COUNT(*) as connect_count
FROM billing_transactions
WHERE transaction_type = 'connect'
  AND (LOWER(agent_email) LIKE '%danielbeasley%' OR LOWER(agent_email) LIKE '%beasley%')
  AND transaction_date >= CURRENT_DATE
  AND transaction_date < CURRENT_DATE + INTERVAL '1 day'
UNION ALL
SELECT 
  'vdp_calls' as source,
  COUNT(*) as connect_count
FROM vdp_calls
WHERE (LOWER(company_email) LIKE '%danielbeasley%' OR LOWER(company_email) LIKE '%beasley%')
  AND updated_at >= CURRENT_DATE
  AND updated_at < CURRENT_DATE + INTERVAL '1 day';
