-- Refund duplicate VDP charges to affected agents
-- Rate: 8 credits per duplicate call
-- ONLY UPDATE credits_purchased (not credits_remaining)

UPDATE user_credits
SET 
  credits_purchased = credits_purchased + 152,
  last_updated = NOW()
WHERE email = 'richiealtig@aoglobelife.com';

UPDATE user_credits
SET 
  credits_purchased = credits_purchased + 128,
  last_updated = NOW()
WHERE email = 'patriciasantamarina@aoglobelife.com';

UPDATE user_credits
SET 
  credits_purchased = credits_purchased + 112,
  last_updated = NOW()
WHERE email = 'cindysheppard@aoglobelife.com';

UPDATE user_credits
SET 
  credits_purchased = credits_purchased + 80,
  last_updated = NOW()
WHERE email = 'susannahart@aoglobelife.com';

UPDATE user_credits
SET 
  credits_purchased = credits_purchased + 72,
  last_updated = NOW()
WHERE email = 'anitaruiz@aoglobelife.com';

UPDATE user_credits
SET 
  credits_purchased = credits_purchased + 64,
  last_updated = NOW()
WHERE email = 'josephinewashington@aoglobelife.com';

UPDATE user_credits
SET 
  credits_purchased = credits_purchased + 64,
  last_updated = NOW()
WHERE email = 'thomasgrant@aoglobelife.com';

UPDATE user_credits
SET 
  credits_purchased = credits_purchased + 32,
  last_updated = NOW()
WHERE email = 'heatherschmidt@aoglobelife.com';

UPDATE user_credits
SET 
  credits_purchased = credits_purchased + 32,
  last_updated = NOW()
WHERE email = 'carmenpierce@aoglobelife.com';

UPDATE user_credits
SET 
  credits_purchased = credits_purchased + 24,
  last_updated = NOW()
WHERE email = 'lucyoliva@aoglobelife.com';

UPDATE user_credits
SET 
  credits_purchased = credits_purchased + 16,
  last_updated = NOW()
WHERE email = 'carleyburgess@aoglobelife.com';

UPDATE user_credits
SET 
  credits_purchased = credits_purchased + 16,
  last_updated = NOW()
WHERE email = 'melissawilson@aoglobelife.com';

UPDATE user_credits
SET 
  credits_purchased = credits_purchased + 16,
  last_updated = NOW()
WHERE email = 'stephaniesmith@aoglobelife.com';

UPDATE user_credits
SET 
  credits_purchased = credits_purchased + 16,
  last_updated = NOW()
WHERE email = 'oliviawalker@aoglobelife.com';

UPDATE user_credits
SET 
  credits_purchased = credits_purchased + 16,
  last_updated = NOW()
WHERE email = 'laurenviloria@aoglobelife.com';

UPDATE user_credits
SET 
  credits_purchased = credits_purchased + 16,
  last_updated = NOW()
WHERE email = 'jessicabrown@aoglobelife.com';

-- Verify the updates
SELECT 
  email,
  credits_purchased,
  credits_remaining,
  last_updated
FROM user_credits
WHERE email IN (
  'richiealtig@aoglobelife.com',
  'patriciasantamarina@aoglobelife.com',
  'cindysheppard@aoglobelife.com',
  'susannahart@aoglobelife.com',
  'anitaruiz@aoglobelife.com',
  'josephinewashington@aoglobelife.com',
  'thomasgrant@aoglobelife.com',
  'heatherschmidt@aoglobelife.com',
  'carmenpierce@aoglobelife.com',
  'lucyoliva@aoglobelife.com',
  'carleyburgess@aoglobelife.com',
  'melissawilson@aoglobelife.com',
  'stephaniesmith@aoglobelife.com',
  'oliviawalker@aoglobelife.com',
  'laurenviloria@aoglobelife.com',
  'jessicabrown@aoglobelife.com'
)
ORDER BY credits_purchased DESC;

-- Summary
-- Total credits added: 984 credits (123 duplicates × 8 credits)
-- Agents affected: 16
-- This adds to credits_purchased ONLY (does NOT touch credits_remaining)

