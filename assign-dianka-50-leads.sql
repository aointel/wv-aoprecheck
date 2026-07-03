-- Assign 50 unassigned pending/null/called leads to Dianka
WITH unassigned_leads AS (
  SELECT id
  FROM masterlead
  WHERE cn_email IS NULL
    AND dnc = false
    AND state != 'DC'
    AND (cnresolution IS NULL OR cnresolution IN ('pending', 'called', ''))
    AND (cnresolution NOT IN ('booked', 'closed', 'sale', 'already_been_sold') OR cnresolution IS NULL)
  LIMIT 50
)
UPDATE masterlead
SET 
  cn_email = 'diankablash@aoglobelife.com',
  assigned_date = NOW(),
  cnresolution = 'pending'
WHERE id IN (SELECT id FROM unassigned_leads);

-- Show results
SELECT COUNT(*) as leads_assigned FROM unassigned_leads;

