-- Assign some leads to cnsysop@aoglobelife.com for testing My Leads queue
-- This script assigns leads with ao_lead_box values to cnsysop

-- Update leads with ao_lead_box to be assigned to cnsysop
-- PostgreSQL doesn't support LIMIT in UPDATE, so use a subquery
UPDATE masterlead
SET 
  associate_id = NULL, -- Clear associate_id if needed
  cn_email = 'cnsysop@aoglobelife.com',
  updated_at = NOW()
WHERE id IN (
  SELECT id 
  FROM masterlead
  WHERE 
    ao_lead_box IS NOT NULL 
    AND ao_lead_box != ''
    AND cnresolution = 'pending'
  LIMIT 100
);

-- Verify the update
SELECT 
  COUNT(*) as total_assigned,
  ao_lead_box,
  COUNT(*) FILTER (WHERE ao_lead_box = 'intown') as intown_count,
  COUNT(*) FILTER (WHERE ao_lead_box = 'road-trip') as roadtrip_count,
  COUNT(*) FILTER (WHERE ao_lead_box = 'list') as list_count,
  COUNT(*) FILTER (WHERE ao_lead_box = 'lapse') as lapse_count
FROM masterlead
WHERE 
  cn_email = 'cnsysop@aoglobelife.com'
  AND ao_lead_box IS NOT NULL
  AND ao_lead_box != ''
GROUP BY ao_lead_box;
