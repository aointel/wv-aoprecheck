-- Compare cnsysop (WORKING) vs leynatran (BROKEN)

-- 1. Check auth.users for both
SELECT 
  email,
  id,
  created_at,
  email_confirmed_at,
  phone,
  raw_user_meta_data,
  raw_app_meta_data
FROM auth.users 
WHERE email IN ('cnsysop@aoglobelife.com', 'leynatran@aoglobelife.com');

-- 2. Check producers table
SELECT 
  email,
  associate_id,
  name,
  status,
  phone,
  mga,
  array_length(states, 1) as num_states,
  array_length(markets, 1) as num_markets
FROM producers 
WHERE email IN ('cnsysop@aoglobelife.com', 'leynatran@aoglobelife.com');

-- 3. Check profiles table
SELECT 
  email,
  "firstName",
  "lastName",
  phone,
  "isAdmin",
  "createdAt"
FROM profiles
WHERE email IN ('cnsysop@aoglobelife.com', 'leynatran@aoglobelife.com');

-- 4. Check if there are any blocked/restricted flags
SELECT 
  table_name,
  column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (column_name LIKE '%block%' OR column_name LIKE '%restrict%' OR column_name LIKE '%disabled%')
ORDER BY table_name;

