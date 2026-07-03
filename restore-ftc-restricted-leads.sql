-- Reset FTCRESTRICTED column to allow all leads to be callable
-- This is useful if you want to manually override FTC time restrictions

UPDATE masterlead
SET 
  FTCRESTRICTED = 'NO',
  updated_at = NOW()
WHERE FTCRESTRICTED = 'YES';

-- Show count of restored leads
SELECT 
  COUNT(*) as unrestricted_count,
  'Leads set to FTCRESTRICTED=NO (now callable)' as status
FROM masterlead
WHERE FTCRESTRICTED = 'NO';

-- If any leads were incorrectly marked with cnresolution='ftc_restricted', restore them
UPDATE masterlead
SET 
  cnresolution = 'pending',
  resolution_notes = 'Restored from incorrect ftc_restricted cnresolution',
  updated_at = NOW()
WHERE cnresolution = 'ftc_restricted';

SELECT COUNT(*) as restored_from_bad_cnresolution 
FROM masterlead 
WHERE resolution_notes LIKE '%Restored from incorrect ftc_restricted%';
