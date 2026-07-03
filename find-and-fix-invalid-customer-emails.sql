-- ============================================================================
-- Find and Fix Invalid Customer Email Records
-- ============================================================================
-- This finds customer records with invalid/fake emails like "agentuser@aoglobelife.com"
-- These are likely test records or data corruption that should be deleted or fixed
-- ============================================================================

-- First, find all suspicious customer records
SELECT 
  id,
  company_email,
  personal_email,
  first_name,
  last_name,
  agent_name,
  associate_id,
  created_at
FROM public.customers
WHERE 
  -- Find emails that look like placeholders or test data
  (
    company_email ILIKE '%agentuser%' OR
    company_email ILIKE '%test%' OR
    company_email ILIKE '%placeholder%' OR
    company_email ILIKE '%dummy%' OR
    company_email ILIKE '%example%' OR
    -- Emails that don't look like real emails
    company_email NOT LIKE '%@%.%' OR
    -- Emails with suspicious patterns
    company_email = LOWER(company_email) AND company_email LIKE '%user%' AND company_email LIKE '%agent%'
  )
  OR
  -- Also find records where first_name = 'Agent' AND last_name = 'User' (our placeholder)
  (first_name = 'Agent' AND last_name = 'User')
ORDER BY created_at DESC;

-- ============================================================================
-- DELETE invalid customer records (UNCOMMENT TO RUN - BE CAREFUL!)
-- ============================================================================
-- This will delete customer records with fake/invalid emails like "agentuser@aoglobelife.com"
-- These are test/placeholder records that shouldn't exist
-- ============================================================================
DELETE FROM public.customers
WHERE 
  (
    company_email ILIKE '%agentuser%' OR
    company_email ILIKE '%test%@aoglobelife.com' OR
    company_email ILIKE '%placeholder%@aoglobelife.com' OR
    company_email ILIKE '%dummy%@aoglobelife.com' OR
    company_email ILIKE '%example%@aoglobelife.com' OR
    company_email NOT LIKE '%@%.%' OR
    -- Specifically target the "agentuser" pattern
    (company_email = 'agentuser@aoglobelife.com')
  )
  OR
  (first_name = 'Agent' AND last_name = 'User' AND company_email ILIKE '%agentuser%');

-- Also delete associated user_credits records
DELETE FROM public.user_credits
WHERE email IN (
  SELECT company_email FROM public.customers
  WHERE company_email ILIKE '%agentuser%'
     OR company_email = 'agentuser@aoglobelife.com'
     OR (first_name = 'Agent' AND last_name = 'User' AND company_email ILIKE '%agentuser%')
);
-- ============================================================================

-- ============================================================================
-- Check if these invalid emails exist in auth.users (they shouldn't!)
-- ============================================================================
-- SELECT 
--   id,
--   email,
--   created_at
-- FROM auth.users
-- WHERE email ILIKE '%agentuser%' 
--    OR email ILIKE '%test%'
--    OR email ILIKE '%placeholder%';
-- ============================================================================

