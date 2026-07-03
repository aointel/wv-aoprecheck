-- Manually assign 50 unassigned pending leads to Patricia Santamarina

-- Assign 50 unassigned leads to patriciasantamarina@aoglobelife.com
UPDATE masterlead
SET 
  cn_email = 'patriciasantamarina@aoglobelife.com',
  last_assigned_date = NOW(),
  updated_at = NOW()
WHERE id IN (
  SELECT id 
  FROM masterlead
  WHERE cnresolution = 'pending'
    AND (cn_email IS NULL OR cn_email = '')
    AND dnc = false
  ORDER BY created_at DESC
  LIMIT 50
)
RETURNING id, first_name, last_name, phone, state;

-- Verify she now has 50 pending leads
SELECT COUNT(*) as pending_leads
FROM masterlead
WHERE cn_email = 'patriciasantamarina@aoglobelife.com'
  AND cnresolution = 'pending';

