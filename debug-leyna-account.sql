-- Debug Leyna's account to find why WebRTC fails

-- 1. Check her user account
SELECT * FROM auth.users 
WHERE email = 'leynatran@aoglobelife.com';

-- 2. Check her producer record
SELECT * FROM producers 
WHERE company_email = 'leynatran@aoglobelife.com';

-- 3. Check her associate_id
SELECT associate_id, company_email, first_name, last_name, active_status
FROM producers 
WHERE company_email = 'leynatran@aoglobelife.com';

-- 4. Compare with a WORKING agent (like Martin)
SELECT associate_id, company_email, first_name, last_name, active_status
FROM producers 
WHERE company_email IN ('leynatran@aoglobelife.com', 'martintoma@aoglobelife.com');

-- 5. Check if there are multiple records for her email
SELECT COUNT(*) as record_count, company_email
FROM producers
WHERE company_email = 'leynatran@aoglobelife.com'
GROUP BY company_email;

-- 6. Check her profile
SELECT * FROM profiles
WHERE email = 'leynatran@aoglobelife.com';

