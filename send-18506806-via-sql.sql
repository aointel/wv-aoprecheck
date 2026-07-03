-- STEP 1: Check current status of lead 18506806
SELECT 
  id,
  taalk_lead_id,
  first_name,
  last_name,
  cn_email,
  cnresolution,
  resolved_at,
  webhook_sent_at
FROM masterlead
WHERE taalk_lead_id = '18506806';

-- STEP 2: Get the agent's associate_id
SELECT 
  company_email,
  associate_id,
  first_name,
  last_name
FROM customers
WHERE company_email = (
  SELECT LOWER(TRIM(cn_email))
  FROM masterlead
  WHERE taalk_lead_id = '18506806'
);

-- STEP 3: Reset webhook_sent_at to NULL for lead 18506806
-- This will make the automatic webhook sender pick it up
UPDATE masterlead
SET webhook_sent_at = NULL
WHERE taalk_lead_id = '18506806';

-- Verify it was reset
SELECT 
  taalk_lead_id,
  first_name,
  last_name,
  webhook_sent_at,
  CASE 
    WHEN webhook_sent_at IS NULL THEN '✅ Ready to send'
    ELSE 'Already sent'
  END as status
FROM masterlead
WHERE taalk_lead_id = '18506806';

