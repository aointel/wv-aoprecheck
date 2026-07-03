-- Check carlos's connects - why does he have 24 connects with 0 dialed/reached?

-- 1. Check billing_transactions for carlos
SELECT 
  transaction_type,
  transaction_date,
  credits_charged,
  amount_usd,
  agent_email,
  lead_name,
  lead_phone
FROM billing_transactions
WHERE agent_email = 'carlosarmandoalfagofarge@aoglobelife.com'
  AND transaction_type = 'connect'
ORDER BY transaction_date DESC;

-- 2. Check live_call_boardt for carlos
SELECT 
  agent_email,
  today_dialed,
  today_reached,
  today_booked,
  today_connects,
  connects, -- Check if this old column exists
  updated_at
FROM live_call_boardt
WHERE agent_email = 'carlosarmandoalfagofarge@aoglobelife.com';

-- 3. Count connects TODAY only
SELECT 
  COUNT(*) as connects_today,
  SUM(credits_charged) as total_credits
FROM billing_transactions
WHERE agent_email = 'carlosarmandoalfagofarge@aoglobelife.com'
  AND transaction_type = 'connect'
  AND transaction_date >= date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York'
  AND transaction_date < date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York' + interval '1 day';

-- 4. Count ALL connects (not filtered by date)
SELECT 
  COUNT(*) as total_connects_all_time,
  MIN(transaction_date) as first_connect,
  MAX(transaction_date) as last_connect
FROM billing_transactions
WHERE agent_email = 'carlosarmandoalfagofarge@aoglobelife.com'
  AND transaction_type = 'connect';
