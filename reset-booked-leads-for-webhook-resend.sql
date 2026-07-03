-- Reset all booked leads to be resent to Planet ALTIG Zapier webhook
-- This sets webhook_sent_at to NULL so they'll be picked up by the automatic sender

-- First, check how many booked leads exist
SELECT 
  'Total Booked Leads' as label,
  COUNT(*) as count
FROM masterlead
WHERE cnresolution = 'booked';

-- Check how many have already been sent
SELECT 
  'Already Sent to Webhook' as label,
  COUNT(*) as count
FROM masterlead
WHERE cnresolution = 'booked'
  AND webhook_sent_at IS NOT NULL;

-- Check how many are pending to be sent
SELECT 
  'Pending Webhook Send' as label,
  COUNT(*) as count
FROM masterlead
WHERE cnresolution = 'booked'
  AND webhook_sent_at IS NULL;

-- RESET: Clear webhook_sent_at for ALL booked leads
-- This will cause them to be resent to the Zapier webhook
UPDATE masterlead
SET 
  webhook_sent_at = NULL,
  updated_at = NOW()
WHERE cnresolution = 'booked';

-- Show how many were reset
SELECT 
  'Booked Leads Reset for Resend' as label,
  COUNT(*) as count
FROM masterlead
WHERE cnresolution = 'booked'
  AND webhook_sent_at IS NULL;

-- Show sample of leads that will be resent (with required fields)
SELECT 
  id,
  taalk_lead_id,
  first_name,
  last_name,
  phone,
  cn_email,
  resolved_at,
  webhook_sent_at,
  CASE 
    WHEN taalk_lead_id IS NULL THEN '❌ MISSING lead_id'
    WHEN cn_email IS NULL THEN '❌ MISSING agent email'
    ELSE '✅ Ready to send'
  END as webhook_status
FROM masterlead
WHERE cnresolution = 'booked'
ORDER BY resolved_at DESC
LIMIT 20;

-- Check for any booked leads missing required data
SELECT 
  'Missing taalk_lead_id' as issue,
  COUNT(*) as count
FROM masterlead
WHERE cnresolution = 'booked'
  AND taalk_lead_id IS NULL;

SELECT 
  'Missing cn_email (agent)' as issue,
  COUNT(*) as count
FROM masterlead
WHERE cnresolution = 'booked'
  AND cn_email IS NULL;

-- Leads with missing data (won't be sent until fixed)
SELECT 
  id,
  taalk_lead_id,
  cn_email,
  first_name,
  last_name,
  phone,
  resolved_at
FROM masterlead
WHERE cnresolution = 'booked'
  AND (taalk_lead_id IS NULL OR cn_email IS NULL)
ORDER BY resolved_at DESC
LIMIT 10;

