-- Reset ALL pending/called/null/blank leads to pending and unassign them
UPDATE masterlead
SET 
  previous_cn_email = cn_email,
  last_assigned_date = NOW(),
  cn_email = NULL,
  assigned_date = NULL,
  cnresolution = 'pending'
WHERE 
  dnc = false
  AND (cnresolution IS NULL OR cnresolution IN ('pending', 'called', ''));

-- Show how many were affecteda
SELECT COUNT(*) as total_leads_reset FROM masterlead
WHERE 
  dnc = false
  AND (cnresolution IS NULL OR cnresolution IN ('pending', 'called', ''));

