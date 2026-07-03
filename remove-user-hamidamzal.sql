-- Remove user hamidamzal@aoglobelife.com from Supabase authentication tables
-- 
-- WARNING: This will permanently delete the user from authentication
-- This script handles foreign key constraints by deleting related records first

-- Step 1: Check if user exists and get their ID
SELECT 
  id,
  email,
  created_at,
  last_sign_in_at
FROM auth.users
WHERE email = 'hamidamzal@aoglobelife.com';

-- Step 2: Delete from transactions table (handles foreign key constraint)
-- This must be done BEFORE deleting from auth.users
DELETE FROM transactions
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'hamidamzal@aoglobelife.com'
);

-- Step 3: Delete from other tables that might reference auth.users
-- Uncomment and add more DELETE statements if needed:

-- DELETE FROM user_roles
-- WHERE user_id = (SELECT id FROM auth.users WHERE email = 'hamidamzal@aoglobelife.com');

-- DELETE FROM agent_profiles
-- WHERE supabase_user_id = (SELECT id::text FROM auth.users WHERE email = 'hamidamzal@aoglobelife.com');

-- DELETE FROM agent_notifications
-- WHERE agent_email = 'hamidamzal@aoglobelife.com';

-- Step 4: Delete the user from auth.users
-- This will cascade delete related auth records (sessions, identities, etc.)
DELETE FROM auth.users
WHERE email = 'hamidamzal@aoglobelife.com';

-- Verify deletion
SELECT 
  id,
  email
FROM auth.users
WHERE email = 'hamidamzal@aoglobelife.com';

-- If the above returns no rows, the user has been successfully removed

