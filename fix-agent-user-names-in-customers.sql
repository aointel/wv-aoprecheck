-- ============================================================================
-- Fix "Agent User" names in customers table
-- ============================================================================
-- This SQL updates customer records that have "Agent" and "User" as first_name/last_name
-- It extracts the name from the email address (e.g., john.doe@email.com -> John Doe)
-- ============================================================================

-- For emails with dots (e.g., john.doe@email.com), split into first and last name
UPDATE public.customers
SET 
  first_name = INITCAP(SPLIT_PART(SPLIT_PART(company_email, '@', 1), '.', 1)),
  last_name = INITCAP(SPLIT_PART(SPLIT_PART(company_email, '@', 1), '.', 2)),
  agent_name = INITCAP(SPLIT_PART(SPLIT_PART(company_email, '@', 1), '.', 1)) || ' ' || 
                INITCAP(SPLIT_PART(SPLIT_PART(company_email, '@', 1), '.', 2))
WHERE 
  (first_name = 'Agent' OR first_name IS NULL OR first_name = '')
  AND (last_name = 'User' OR last_name IS NULL OR last_name = '')
  AND company_email LIKE '%.%@%'  -- Email has at least one dot before @
  AND SPLIT_PART(SPLIT_PART(company_email, '@', 1), '.', 2) != '';  -- Has a second part after the dot

-- Update customers where email doesn't have dots or only has one part
-- Extract name from email (e.g., johndoe@email.com -> Johndoe)
UPDATE public.customers
SET 
  first_name = INITCAP(SPLIT_PART(company_email, '@', 1)),
  last_name = '',
  agent_name = INITCAP(SPLIT_PART(company_email, '@', 1))
WHERE 
  (first_name = 'Agent' OR first_name IS NULL OR first_name = '')
  AND (last_name = 'User' OR last_name IS NULL OR last_name = '')
  AND company_email IS NOT NULL
  AND NOT (company_email LIKE '%.%@%' AND SPLIT_PART(SPLIT_PART(company_email, '@', 1), '.', 2) != '');

-- ============================================================================
-- Verification Query (optional - run after migration to verify updates)
-- ============================================================================
-- SELECT 
--   company_email,
--   first_name,
--   last_name,
--   agent_name
-- FROM public.customers
-- WHERE first_name = 'Agent' OR last_name = 'User'
-- ORDER BY company_email;
-- ============================================================================

