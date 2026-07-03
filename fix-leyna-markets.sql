-- Fix Leyna's producer record - add markets and remove duplicate

-- 1. Update her record with proper markets (use Chris LaFond's markets as template)
UPDATE producers 
SET markets = ARRAY[
  'Veteran',
  'WillKit', 
  'Globe',
  'GlobeLapsed',
  'WomensBenefit',
  'VetPlus',
  'WillKitPlus',
  'SMB',
  'SMBPlus',
  'Mcgruff',
  'McgruffPlus',
  'LifeLead',
  'LifeLeadPlus',
  'CSK',
  'CSKplus',
  'CSKSPN',
  'CSKSPNplus'
]::text[]
WHERE email = 'leynatran@aoglobelife.com'
  AND id = 151; -- Keep the older record

-- 2. Delete the duplicate record (keep id 151, remove id 2048)
DELETE FROM producers 
WHERE email = 'leynatran@aoglobelife.com' 
  AND id = 2048;

-- 3. Verify the fix
SELECT 
  id,
  email,
  name,
  associate_id,
  array_length(markets, 1) as num_markets,
  array_length(states, 1) as num_states,
  status
FROM producers
WHERE email = 'leynatran@aoglobelife.com';

