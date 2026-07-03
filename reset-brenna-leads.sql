-- RESET: Reset all cn_resolution to 'pending' and unassign leads from brennabailey@aoglobelife.com
-- Run this in Supabase SQL Editor

-- Step 1: Check how many leads are currently assigned to brenna
SELECT 
  COUNT(*) as total_leads,
  COUNT(CASE WHEN cnresolution IS NOT NULL AND cnresolution != 'pending' THEN 1 END) as leads_with_resolution,
  COUNT(CASE WHEN cnresolution = 'pending' THEN 1 END) as already_pending
FROM masterlead
WHERE cn_email = 'brennabailey@aoglobelife.com';

-- Step 2: Show sample of leads that will be reset
SELECT 
  id,
  first_name,
  last_name,
  phone,
  cn_email,
  cnresolution,
  updated_at
FROM masterlead
WHERE cn_email = 'brennabailey@aoglobelife.com'
ORDER BY updated_at DESC
LIMIT 10;

-- Step 3: Reset all cn_resolution to 'pending' and unassign from brenna
UPDATE masterlead
SET 
  cn_email = NULL,
  cnresolution = 'pending',
  updated_at = now()
WHERE cn_email = 'brennabailey@aoglobelife.com';

-- Step 4: Verify the update
SELECT 
  COUNT(*) as remaining_assigned,
  COUNT(CASE WHEN cnresolution != 'pending' THEN 1 END) as non_pending_resolutions
FROM masterlead
WHERE cn_email = 'brennabailey@aoglobelife.com';

-- Step 5: Show summary of what was reset
SELECT 
  'Leads unassigned and reset to pending' as action,
  COUNT(*) as count
FROM masterlead
WHERE cn_email IS NULL 
  AND cnresolution = 'pending'
  AND updated_at >= now() - interval '5 minutes';

