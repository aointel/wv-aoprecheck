-- Update phone number for all PENDING leads assigned to Tabitha
-- Changes phone to 5032018470 for all pending leads where cn_email = tabithamcdermid@aoglobelife.com

UPDATE masterlead
SET phone = '5032018470'
WHERE cn_email = 'tabithamcdermid@aoglobelife.com'
  AND cnresolution = 'pending';

-- Check how many records will be updated (run this first to verify)
-- SELECT COUNT(*) FROM masterlead WHERE cn_email = 'tabithamcdermid@aoglobelife.com' AND cnresolution = 'pending';

-- View the leads that will be updated (run this first to verify)
-- SELECT id, first_name, last_name, phone, cn_email, cnresolution 
-- FROM masterlead 
-- WHERE cn_email = 'tabithamcdermid@aoglobelife.com' 
--   AND cnresolution = 'pending';

