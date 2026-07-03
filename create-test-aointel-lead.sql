-- Create a test AOIntel lead for cnsysop that will display in /connect
-- This lead will show up in the AOIntel queue NO MATTER WHAT

INSERT INTO masterlead (
  id,
  first_name,
  last_name,
  phone,
  state,
  taalk_state,
  cn_email,
  cnresolution,
  source_table,
  is_hot_lead,
  dnc,
  created_at,
  updated_at,
  assigned_date
) VALUES (
  999999, -- Use a high ID to avoid conflicts
  'Test',
  'AOIntel Lead',
  '5551234567',
  'TX',
  'TX',
  'cnsysop@aoglobelife.com',
  'aointel', -- Lowercase as specified
  'ao_intel_inbound',
  true,
  false, -- Not DNC so it shows
  NOW(),
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  cn_email = EXCLUDED.cn_email,
  cnresolution = EXCLUDED.cnresolution,
  updated_at = NOW(),
  assigned_date = NOW();

-- Verify the lead was created
SELECT 
  id,
  first_name,
  last_name,
  phone,
  cn_email,
  cnresolution,
  source_table,
  is_hot_lead,
  dnc,
  created_at,
  updated_at
FROM masterlead
WHERE id = 999999;

