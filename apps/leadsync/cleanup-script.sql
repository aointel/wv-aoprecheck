DO $$
BEGIN
  -- 1) Delete from public and auth tables
  UPDATE auth.users
    SET referrer_id = NULL
   WHERE referrer_id::text IN (
         SELECT id::text FROM auth.users
          WHERE email LIKE '%@aoglobelife.com'
       );

  DELETE FROM public.customers
   WHERE user_id::text IN (
         SELECT id::text FROM auth.users
          WHERE email LIKE '%@aoglobelife.com'
       );

  DELETE FROM auth.refresh_tokens
   WHERE user_id::text IN (
         SELECT id::text FROM auth.users
          WHERE email LIKE '%@aoglobelife.com'
       );
  
  -- etc., for each table referencing auth.users
  
  -- Finally, delete the users
  DELETE FROM auth.users
   WHERE email LIKE '%@aoglobelife.com';
END $$; 