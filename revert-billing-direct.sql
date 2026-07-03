-- Direct SQL to revert the billing fixes
-- Run this in Supabase SQL editor

-- 1. Delete created records
DELETE FROM user_credits WHERE email = 'hernanplazola@aoglobelife.com';
DELETE FROM user_credits WHERE email = 'hannahjames@aoglobelife.com';

-- 2. Revert updated records
UPDATE user_credits 
SET credits_used = 24, updated_at = NOW()
WHERE email = 'julialeroy@aoglobelife.com';

UPDATE user_credits 
SET credits_used = 288, updated_at = NOW()
WHERE email = 'jameshannah@aoglobelife.com';

UPDATE user_credits 
SET credits_used = 8, updated_at = NOW()
WHERE email = 'muhammadzohaib@aoglobelife.com';

-- Verify
SELECT email, credits_used, credits_remaining, credits_purchased
FROM user_credits
WHERE email IN (
  'julialeroy@aoglobelife.com',
  'jameshannah@aoglobelife.com',
  'muhammadzohaib@aoglobelife.com'
);
