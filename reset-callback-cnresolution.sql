-- Reset all 'callback' cnresolution values to NULL
-- This allows callbacks to be redialed/treated as fresh leads

UPDATE masterlead 
SET cnresolution = NULL 
WHERE cnresolution = 'callback';

-- Check how many were updated
SELECT 
  COUNT(*) as total_reset,
  'callback cnresolutions reset to NULL' as message
FROM masterlead 
WHERE cnresolution IS NULL;

-- Optional: Verify no more 'callback' values exist
SELECT 
  COUNT(*) as remaining_callbacks
FROM masterlead 
WHERE cnresolution = 'callback';

