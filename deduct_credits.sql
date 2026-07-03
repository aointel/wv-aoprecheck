-- Deduct 64 credits from credits_purchased for specified agents
-- This ensures credits_purchased doesn't go below 0

UPDATE user_credits
SET credits_purchased = GREATEST(0, credits_purchased - 64),
    updated_at = NOW()
WHERE email IN (
    'rochellemagpantay@aoglobelife.com',
    'ogbergamo@gmail.com',
    'rubenfuentes@aoglobelife.com',
    'lindagojcaj@aoglobelife.com',
    'jessicaowens@aoglobelife.com',
    'williampalizo@aoglobelife.com',
    'muntatheralsheeblawy@aoglobelife.com',
    'miguelquinones@aoglobelife.com',
    'marypeterson@aoglobelife.com',
    'mehdielkhatib@aoglobelife.com',
    'collindickinson@aoglobelife.com',
    'jacobvaldellon@aoglobelife.com',
    'kingsleyibeh@aoglobelife.com',
    'rhondaramirez@aoglobelife.com',
    'susanabruzzese@aoglobelife.com',
    'bridgetcallahan@aoglobelife.com',
    'celesterelic@aoglobelife.com',
    'jesserusso@aoglobelife.com',
    'richardlafond@aoglobelife.com',
    'martintoma@aoglobelife.com',
    'patriciasantamarina@aoglobelife.com',
    'lucasgugliotta@aoglobelife.com',
    'lelandprice@aoglobelife.com',
    'joecasiasjr@aoglobelife.com',
    'chrisfanning@aoglobelife.com',
    'davongregory@aoglobelife.com',
    'mohmadalialwatan@aoglobelife.com',
    'ankitadas@aoglobelife.com',
    'aointeldemo@aoglobelife.com'
);

-- Verify the update (optional - run this to see results)
SELECT 
    email,
    credits_purchased,
    credits_purchased + 64 AS previous_credits_purchased
FROM user_credits
WHERE email IN (
    'rochellemagpantay@aoglobelife.com',
    'ogbergamo@gmail.com',
    'rubenfuentes@aoglobelife.com',
    'lindagojcaj@aoglobelife.com',
    'jessicaowens@aoglobelife.com',
    'williampalizo@aoglobelife.com',
    'muntatheralsheeblawy@aoglobelife.com',
    'miguelquinones@aoglobelife.com',
    'marypeterson@aoglobelife.com',
    'mehdielkhatib@aoglobelife.com',
    'collindickinson@aoglobelife.com',
    'jacobvaldellon@aoglobelife.com',
    'kingsleyibeh@aoglobelife.com',
    'rhondaramirez@aoglobelife.com',
    'susanabruzzese@aoglobelife.com',
    'bridgetcallahan@aoglobelife.com',
    'celesterelic@aoglobelife.com',
    'jesserusso@aoglobelife.com',
    'richardlafond@aoglobelife.com',
    'martintoma@aoglobelife.com',
    'patriciasantamarina@aoglobelife.com',
    'lucasgugliotta@aoglobelife.com',
    'lelandprice@aoglobelife.com',
    'joecasiasjr@aoglobelife.com',
    'chrisfanning@aoglobelife.com',
    'davongregory@aoglobelife.com',
    'mohmadalialwatan@aoglobelife.com',
    'ankitadas@aoglobelife.com',
    'aointeldemo@aoglobelife.com'
)
ORDER BY email;




