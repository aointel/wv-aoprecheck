-- Check if lead 18506806 was sent to webhook
SELECT 
  taalk_lead_id,
  first_name,
  last_name,
  cn_email,
  cnresolution,
  resolved_at,
  webhook_sent_at,
  CASE 
    WHEN webhook_sent_at IS NOT NULL THEN '✅ YES - SENT'
    WHEN cnresolution != 'booked' THEN '❌ NO - Not marked as booked'
    WHEN taalk_lead_id IS NULL THEN '❌ NO - Missing taalk_lead_id'
    WHEN cn_email IS NULL THEN '❌ NO - Missing agent email'
    ELSE '⏳ NO - Pending'
  END as status
FROM masterlead
WHERE taalk_lead_id = '18506806';

