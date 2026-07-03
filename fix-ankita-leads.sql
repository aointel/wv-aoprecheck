-- Step 1: Check Ankita's actual market and states configuration
SELECT 
  company_email,
  first_name,
  last_name,
  states,
  market,
  associate_id
FROM customers
WHERE company_email = 'ankitadas@aoglobelife.com';

-- Step 2: Unassign all leads currently assigned to Ankita (reset them)
UPDATE masterlead
SET 
  cn_email = NULL,
  cnresolution = 'pending',
  last_assigned_date = NULL,
  updated_at = NOW()
WHERE cn_email = 'ankitadas@aoglobelife.com'
  AND cnresolution = 'pending'
RETURNING id, first_name, last_name, phone, state, taalk_market;

-- Step 3: Verify all her leads are now unassigned
SELECT COUNT(*) as ankita_pending_count
FROM masterlead
WHERE cn_email = 'ankitadas@aoglobelife.com'
  AND cnresolution = 'pending';

