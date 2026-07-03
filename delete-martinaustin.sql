-- Delete martinaustin@aoglobelife.com from authentication

-- 1. First delete transactions (foreign key constraint)
DELETE FROM transactions 
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'martinaustin@aoglobelife.com');

-- 2. Delete from Supabase authentication (auth.users)
DELETE FROM auth.users 
WHERE email = 'martinaustin@aoglobelife.com';

-- Show results
SELECT 'martinaustin@aoglobelife.com deleted from authentication' as result;

