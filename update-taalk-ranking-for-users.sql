-- ============================================================================
-- Update Taalk Ranking (distribution_priority) for Specific Users
-- ============================================================================
-- This script updates the distribution_priority in agent_profiles table
-- distribution_priority: 1 = highest priority, 5 = lowest priority
-- Lower numbers = higher priority for lead assignment
-- ============================================================================

-- Update distribution_priority for the specified users
-- Change the priority value (1-5) as needed:
-- 1 = Highest priority (gets leads first)
-- 2 = High priority
-- 3 = Normal priority (default)
-- 4 = Low priority
-- 5 = Lowest priority

UPDATE public.agent_profiles
SET 
  distribution_priority = 1,  -- CHANGE THIS VALUE: 1 = highest, 5 = lowest
  updated_at = NOW()
WHERE 
  LOWER(email) IN (
    'cameronchristensen@aoglobelife.com',
    'calebbrown@aoglobelife.com',
    'gavinsynder@aoglobelife.com',
    'bradleesimmons@aoglobelife.com',
    'isaiahnewhouse@aoglobelife.com',
    'shawnsipes@aoglobelife.com',
    'averyflicky@aoglobelife.com',
    'tajward@aoglobelife.com',
    'alonzoalexander@aoglobelife.com',
    'willmusik@aoglobelife.com'
  );

-- ============================================================================
-- Verification Query (run after update to verify changes)
-- ============================================================================
SELECT 
  email,
  first_name,
  last_name,
  distribution_priority,
  updated_at
FROM public.agent_profiles
WHERE LOWER(email) IN (
  'cameronchristensen@aoglobelife.com',
  'calebbrown@aoglobelife.com',
  'gavinsynder@aoglobelife.com',
  'bradleesimmons@aoglobelife.com',
  'isaiahnewhouse@aoglobelife.com',
  'shawnsipes@aoglobelife.com',
  'averyflicky@aoglobelife.com',
  'tajward@aoglobelife.com',
  'alonzoalexander@aoglobelife.com',
  'willmusik@aoglobelife.com'
)
ORDER BY distribution_priority, email;
-- ============================================================================

