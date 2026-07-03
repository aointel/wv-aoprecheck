-- Add 5 demo AOI cards for cnsysop@aoglobelife.com for testing
-- Run this in Supabase SQL Editor

-- First, ensure the table exists (create if it doesn't)
CREATE TABLE IF NOT EXISTS war_connects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connect_id TEXT NOT NULL UNIQUE,
  agent_email TEXT NOT NULL,
  lead_name TEXT NOT NULL,
  lead_phone TEXT NOT NULL,
  connect_date TIMESTAMP NOT NULL,
  connect_time TEXT NOT NULL,
  duration INTEGER NOT NULL,
  lead_source TEXT,
  market TEXT NOT NULL,
  state TEXT NOT NULL,
  connect_type TEXT NOT NULL,
  production_status TEXT DEFAULT 'pending',
  immediate_outcome TEXT,
  disposition TEXT,
  appointment_set BOOLEAN DEFAULT false,
  appointment_date TIMESTAMP,
  sale_amount DECIMAL(10,2),
  follow_up_required BOOLEAN DEFAULT false,
  next_contact_date TIMESTAMP,
  priority_level TEXT DEFAULT 'normal',
  tags JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  reported_at TIMESTAMP,
  review_status TEXT,
  reviewed_at TIMESTAMP,
  next_review_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Now insert the demo cards
INSERT INTO war_connects (
  connect_id, 
  agent_email, 
  lead_name, 
  lead_phone, 
  connect_date, 
  connect_time,
  duration, 
  lead_source, 
  market, 
  state, 
  connect_type, 
  immediate_outcome,
  production_status, 
  follow_up_required, 
  next_contact_date, 
  priority_level, 
  tags
) VALUES
(
  'demo_' || extract(epoch from now())::bigint || '_1',
  'cnsysop@aoglobelife.com',
  'John Demo Smith',
  '5551234567',
  NOW(),
  '14:30',
  300,
  'demo_cards',
  'Veteran Demo',
  'TX',
  'outbound',
  'appointment_set',
  'pending',
  true,
  NOW() + INTERVAL '1 day',
  'high',
  '["demo", "test", "aoi"]'::jsonb
),
(
  'demo_' || extract(epoch from now())::bigint || '_2',
  'cnsysop@aoglobelife.com',
  'Jane Demo Wilson',
  '5551234568',
  NOW(),
  '15:45',
  420,
  'demo_cards',
  'Veteran Demo',
  'FL',
  'outbound',
  'presentation_completed',
  'pending',
  false,
  NULL,
  'medium',
  '["demo", "test", "aoi"]'::jsonb
),
(
  'demo_' || extract(epoch from now())::bigint || '_3',
  'cnsysop@aoglobelife.com',
  'Mike Demo Johnson',
  '5551234569',
  NOW(),
  '10:15',
  180,
  'demo_cards',
  'Veteran Demo',
  'CA',
  'outbound',
  'callback_scheduled',
  'pending',
  true,
  NOW() + INTERVAL '2 days',
  'low',
  '["demo", "test", "aoi"]'::jsonb
),
(
  'demo_' || extract(epoch from now())::bigint || '_4',
  'cnsysop@aoglobelife.com',
  'Sarah Demo Davis',
  '5551234570',
  NOW(),
  '09:30',
  600,
  'demo_cards',
  'Veteran Demo',
  'NY',
  'outbound',
  'sale_completed',
  'pending',
  false,
  NULL,
  'high',
  '["demo", "test", "aoi", "sale"]'::jsonb
),
(
  'demo_' || extract(epoch from now())::bigint || '_5',
  'cnsysop@aoglobelife.com',
  'Robert Demo Taylor',
  '5551234571',
  NOW(),
  '16:20',
  240,
  'demo_cards',
  'Veteran Demo',
  'OH',
  'outbound',
  'not_interested',
  'pending',
  false,
  NULL,
  'low',
  '["demo", "test", "aoi"]'::jsonb
)
ON CONFLICT (connect_id) DO NOTHING;

-- Verify the inserts
SELECT 
  connect_id,
  lead_name,
  immediate_outcome,
  production_status
FROM war_connects
WHERE agent_email = 'cnsysop@aoglobelife.com'
  AND lead_source = 'demo_cards'
ORDER BY connect_date DESC
LIMIT 5;
