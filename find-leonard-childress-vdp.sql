-- Find Leonard Childress in VDP calls table
SELECT 
  id,
  "Date" as call_date,
  "Time" as call_time,
  "Event",
  "Phone",
  "Agent",
  firstname,
  lastname,
  market,
  email,
  city,
  state,
  duration,
  leadid,
  "Params",
  "createdAt"
FROM vdp_calls
WHERE (firstname ILIKE '%leonard%' OR firstname ILIKE '%leonar%')
  AND (lastname ILIKE '%childress%' OR lastname ILIKE '%childres%')
ORDER BY "createdAt" DESC
LIMIT 10;

-- Also search by partial name match in case of typos
SELECT 
  id,
  "Date" as call_date,
  "Time" as call_time,
  "Event",
  "Phone",
  "Agent",
  firstname,
  lastname,
  market,
  email,
  city,
  state,
  duration,
  leadid,
  "Params",
  "createdAt"
FROM vdp_calls
WHERE (firstname ILIKE '%leon%' AND lastname ILIKE '%child%')
   OR (firstname || ' ' || lastname ILIKE '%leonard%childress%')
ORDER BY "createdAt" DESC
LIMIT 10;

-- Check most recent CONNECT events to see if Leonard is there
SELECT 
  id,
  "Date" as call_date,
  "Time" as call_time,
  "Event",
  "Phone",
  "Agent",
  firstname,
  lastname,
  market,
  email,
  city,
  state,
  duration,
  leadid,
  "createdAt"
FROM vdp_calls
WHERE "Event" = 'CONNECT'
  AND "createdAt" >= NOW() - INTERVAL '24 hours'
ORDER BY "createdAt" DESC
LIMIT 20;

-- Once we find Leonard, check if candidate exists
SELECT *
FROM recruit_candidates
WHERE (first_name ILIKE '%leonard%' AND last_name ILIKE '%childress%')
   OR phone IN (
     SELECT "Phone" 
     FROM vdp_calls 
     WHERE firstname ILIKE '%leonard%' 
       AND lastname ILIKE '%childress%'
   );

-- ============================================
-- MANUAL FIX: Insert Leonard as recruit candidate
-- ============================================
-- Replace these values with actual data from the queries above:

/*
INSERT INTO recruit_candidates (
  first_name,
  last_name,
  phone,
  email,
  status,
  current_stage_id,
  stage_entered_at,
  agent_id,
  agent_email,
  notes,
  created_at,
  updated_at
)
SELECT 
  firstname,
  lastname,
  "Phone",
  COALESCE(email, ''),
  'contacted',
  1,  -- AO Recruit stage
  "createdAt",
  COALESCE(
    (SELECT customer_email FROM customers WHERE associate_id::text = "Agent" LIMIT 1),
    'unknown@aoglobelife.com'
  ),
  COALESCE(
    (SELECT customer_email FROM customers WHERE associate_id::text = "Agent" LIMIT 1),
    'unknown@aoglobelife.com'
  ),
  'Auto-created from VDP call on ' || "Date" || ' at ' || "Time" || ' (Market: ' || COALESCE(market, 'unknown') || ')',
  NOW(),
  NOW()
FROM vdp_calls
WHERE firstname ILIKE '%leonard%'
  AND lastname ILIKE '%childress%'
  AND "Event" = 'CONNECT'
ORDER BY "createdAt" DESC
LIMIT 1
RETURNING *;
*/

