-- Refund duplicate VDP charges to affected agents
-- Rate: 8 credits per duplicate call
-- ONLY UPDATE credits_purchased (not credits_remaining)
-- Using REAL emails from customers table

UPDATE user_credits SET credits_purchased = credits_purchased + 152 WHERE email = 'gageharrington@aoglobelife.com';
UPDATE user_credits SET credits_purchased = credits_purchased + 112 WHERE email = 'josiahmonett@aoglobelife.com';
UPDATE user_credits SET credits_purchased = credits_purchased + 96 WHERE email = 'mohamedalgohaim@aoglobelife.com';
UPDATE user_credits SET credits_purchased = credits_purchased + 80 WHERE email = 'anthonylulgjuraj@aoglobelife.com';
UPDATE user_credits SET credits_purchased = credits_purchased + 80 WHERE email = 'devingould@aoglobelife.com';
UPDATE user_credits SET credits_purchased = credits_purchased + 72 WHERE email = 'millergerald@aoglobelife.com';
UPDATE user_credits SET credits_purchased = credits_purchased + 64 WHERE email = 'chrislafond@aoglobelife.com';
UPDATE user_credits SET credits_purchased = credits_purchased + 64 WHERE email = 'lisablanco@aoglobelife.com';
UPDATE user_credits SET credits_purchased = credits_purchased + 32 WHERE email = 'dominiquecarter@aoglobelife.com';
UPDATE user_credits SET credits_purchased = credits_purchased + 32 WHERE email = 'jacobvaldellon@aoglobelife.com';
UPDATE user_credits SET credits_purchased = credits_purchased + 32 WHERE email = 'ankitadas@aoglobelife.com';
UPDATE user_credits SET credits_purchased = credits_purchased + 24 WHERE email = 'arthurscott@aoglobelife.com';
UPDATE user_credits SET credits_purchased = credits_purchased + 16 WHERE email = 'bridgetcallahan@aoglobelife.com';
UPDATE user_credits SET credits_purchased = credits_purchased + 16 WHERE email = 'richardlafond@aoglobelife.com';
UPDATE user_credits SET credits_purchased = credits_purchased + 16 WHERE email = 'jameshannah@aoglobelife.com';
UPDATE user_credits SET credits_purchased = credits_purchased + 16 WHERE email = 'joecasiasjr@aoglobelife.com';
UPDATE user_credits SET credits_purchased = credits_purchased + 16 WHERE email = 'francesbrewer@aoglobelife.com';
UPDATE user_credits SET credits_purchased = credits_purchased + 16 WHERE email = 'smithterrell@aoglobelife.com';

-- Verify the updates
SELECT 
  email,
  credits_purchased,
  credits_remaining
FROM user_credits
WHERE email IN (
  'gageharrington@aoglobelife.com',
  'josiahmonett@aoglobelife.com',
  'mohamedalgohaim@aoglobelife.com',
  'anthonylulgjuraj@aoglobelife.com',
  'devingould@aoglobelife.com',
  'millergerald@aoglobelife.com',
  'chrislafond@aoglobelife.com',
  'lisablanco@aoglobelife.com',
  'dominiquecarter@aoglobelife.com',
  'jacobvaldellon@aoglobelife.com',
  'ankitadas@aoglobelife.com',
  'arthurscott@aoglobelife.com',
  'bridgetcallahan@aoglobelife.com',
  'richardlafond@aoglobelife.com',
  'jameshannah@aoglobelife.com',
  'joecasiasjr@aoglobelife.com',
  'francesbrewer@aoglobelife.com',
  'smithterrell@aoglobelife.com'
)
ORDER BY credits_purchased DESC;

-- Summary
-- Total credits added: 928 credits (117 duplicates × 8 credits)
-- Agents affected: 18
-- This adds to credits_purchased ONLY (does NOT touch credits_remaining)

