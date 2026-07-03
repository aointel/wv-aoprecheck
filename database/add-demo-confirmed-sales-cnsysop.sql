-- Add demo Confirmed Sales (submitted applications) for cnsysop@aoglobelife.com for testing
-- Run this in Supabase SQL Editor

-- Ensure columns exist (from add-associate-email-confirmed-to-submitted-applications.sql)
ALTER TABLE submitted_applications
  ADD COLUMN IF NOT EXISTS associate_id INTEGER,
  ADD COLUMN IF NOT EXISTS company_email TEXT,
  ADD COLUMN IF NOT EXISTS confirmed BOOLEAN DEFAULT FALSE;

-- Insert demo confirmed sales with different sale types
INSERT INTO submitted_applications (
  insured,
  agent_release,
  sga_submit,
  policy_number,
  lob,
  cwa,
  alp,
  agent,
  company_email,
  confirmed,
  transfer_type,
  created_at
) VALUES
-- AO: Intelligence Sale
(
  'Michael Confirmed Sale',
  NOW() - INTERVAL '2 days',
  NOW() - INTERVAL '2 days',
  'POL-DEMO-' || extract(epoch from now())::bigint || '-1',
  'Life',
  '125.50',
  1506.00, -- ALP = CWA * 12
  'MANDELLA, MIKE',
  'cnsysop@aoglobelife.com',
  false, -- Not confirmed yet - will show as card
  'aoi_connect', -- AO: Intelligence
  NOW()
),
-- Call Connector Pro Sale
(
  'Jennifer Confirmed Sale',
  NOW() - INTERVAL '1 day',
  NOW() - INTERVAL '1 day',
  'POL-DEMO-' || extract(epoch from now())::bigint || '-2',
  'Life',
  '89.75',
  1077.00, -- ALP = CWA * 12
  'MANDELLA, MIKE',
  'cnsysop@aoglobelife.com',
  false, -- Not confirmed yet - will show as card
  'ccpro_booked', -- Call Connector Pro
  NOW()
),
-- Standard Sale (no transfer_type)
(
  'David Confirmed Sale',
  NOW() - INTERVAL '3 days',
  NOW() - INTERVAL '3 days',
  'POL-DEMO-' || extract(epoch from now())::bigint || '-3',
  'Life',
  '200.00',
  2400.00, -- ALP = CWA * 12
  'MANDELLA, MIKE',
  'cnsysop@aoglobelife.com',
  false, -- Not confirmed yet - will show as card
  NULL, -- Standard (no transfer_type)
  NOW()
),
-- Another AO: Intelligence Sale
(
  'Lisa Confirmed Sale',
  NOW() - INTERVAL '5 days',
  NOW() - INTERVAL '5 days',
  'POL-DEMO-' || extract(epoch from now())::bigint || '-4',
  'Life',
  '150.25',
  1803.00, -- ALP = CWA * 12
  'MANDELLA, MIKE',
  'cnsysop@aoglobelife.com',
  false, -- Not confirmed yet - will show as card
  'aoi_connect', -- AO: Intelligence
  NOW()
),
-- Call Connector Pro Reached Sale
(
  'Robert Confirmed Sale',
  NOW() - INTERVAL '4 days',
  NOW() - INTERVAL '4 days',
  'POL-DEMO-' || extract(epoch from now())::bigint || '-5',
  'Life',
  '95.50',
  1146.00, -- ALP = CWA * 12
  'MANDELLA, MIKE',
  'cnsysop@aoglobelife.com',
  false, -- Not confirmed yet - will show as card
  'ccpro_reached', -- Call Connector Pro (reached)
  NOW()
),
-- Additional Confirmed Sales
-- Standard Sale
(
  'Sarah Johnson',
  NOW() - INTERVAL '6 days',
  NOW() - INTERVAL '6 days',
  'POL-DEMO-' || extract(epoch from now())::bigint || '-6',
  'Annuity',
  '175.00',
  2100.00,
  'MANDELLA, MIKE',
  'cnsysop@aoglobelife.com',
  false,
  NULL,
  NOW()
),
-- AO: Intelligence Sale
(
  'James Wilson',
  NOW() - INTERVAL '7 days',
  NOW() - INTERVAL '7 days',
  'POL-DEMO-' || extract(epoch from now())::bigint || '-7',
  'Life',
  '110.25',
  1323.00,
  'MANDELLA, MIKE',
  'cnsysop@aoglobelife.com',
  false,
  'aoi_connect',
  NOW()
),
-- Call Connector Pro Sale
(
  'Emily Davis',
  NOW() - INTERVAL '8 days',
  NOW() - INTERVAL '8 days',
  'POL-DEMO-' || extract(epoch from now())::bigint || '-8',
  'Life',
  '142.50',
  1710.00,
  'MANDELLA, MIKE',
  'cnsysop@aoglobelife.com',
  false,
  'ccpro_booked',
  NOW()
),
-- Standard Sale
(
  'Christopher Martinez',
  NOW() - INTERVAL '9 days',
  NOW() - INTERVAL '9 days',
  'POL-DEMO-' || extract(epoch from now())::bigint || '-9',
  'Annuity',
  '225.75',
  2709.00,
  'MANDELLA, MIKE',
  'cnsysop@aoglobelife.com',
  false,
  NULL,
  NOW()
),
-- AO: Intelligence Sale
(
  'Amanda Brown',
  NOW() - INTERVAL '10 days',
  NOW() - INTERVAL '10 days',
  'POL-DEMO-' || extract(epoch from now())::bigint || '-10',
  'Life',
  '98.00',
  1176.00,
  'MANDELLA, MIKE',
  'cnsysop@aoglobelife.com',
  false,
  'aoi_connect',
  NOW()
),
-- Call Connector Pro Reached Sale
(
  'Daniel Taylor',
  NOW() - INTERVAL '11 days',
  NOW() - INTERVAL '11 days',
  'POL-DEMO-' || extract(epoch from now())::bigint || '-11',
  'Life',
  '165.00',
  1980.00,
  'MANDELLA, MIKE',
  'cnsysop@aoglobelife.com',
  false,
  'ccpro_reached',
  NOW()
),
-- Standard Sale
(
  'Jessica Anderson',
  NOW() - INTERVAL '12 days',
  NOW() - INTERVAL '12 days',
  'POL-DEMO-' || extract(epoch from now())::bigint || '-12',
  'Annuity',
  '190.50',
  2286.00,
  'MANDELLA, MIKE',
  'cnsysop@aoglobelife.com',
  false,
  NULL,
  NOW()
),
-- AO: Intelligence Sale
(
  'Matthew Thomas',
  NOW() - INTERVAL '13 days',
  NOW() - INTERVAL '13 days',
  'POL-DEMO-' || extract(epoch from now())::bigint || '-13',
  'Life',
  '135.25',
  1623.00,
  'MANDELLA, MIKE',
  'cnsysop@aoglobelife.com',
  false,
  'aoi_connect',
  NOW()
),
-- Call Connector Pro Sale
(
  'Ashley Jackson',
  NOW() - INTERVAL '14 days',
  NOW() - INTERVAL '14 days',
  'POL-DEMO-' || extract(epoch from now())::bigint || '-14',
  'Life',
  '105.00',
  1260.00,
  'MANDELLA, MIKE',
  'cnsysop@aoglobelife.com',
  false,
  'ccpro_booked',
  NOW()
),
-- Standard Sale
(
  'Ryan White',
  NOW() - INTERVAL '15 days',
  NOW() - INTERVAL '15 days',
  'POL-DEMO-' || extract(epoch from now())::bigint || '-15',
  'Annuity',
  '210.00',
  2520.00,
  'MANDELLA, MIKE',
  'cnsysop@aoglobelife.com',
  false,
  NULL,
  NOW()
);

-- Verify the inserts (should show 15 confirmed sales)
SELECT 
  id,
  insured,
  policy_number,
  alp,
  lob,
  transfer_type,
  company_email,
  confirmed,
  sga_submit
FROM submitted_applications
WHERE company_email = 'cnsysop@aoglobelife.com'
  AND confirmed = false
ORDER BY sga_submit DESC
LIMIT 20;
