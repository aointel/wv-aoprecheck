-- ============================================================================
-- BACKFILL MISSING INSTANT PRESENTATIONS FOR TODAY
-- 
-- ⚠️  CRITICAL: RUN FIX_CONSTRAINT_FIRST.sql BEFORE THIS SCRIPT! ⚠️
-- 
-- This script:
-- 1. Finds calls in twilio_call_logs today with duration > 900s (15 minutes)
-- 2. Checks if there's a corresponding instant_presentation event in agent_dial_metrics
-- 3. Creates missing instant_presentation events
-- 4. These events will be counted in BOTH booked and instant_presentation columns
-- ============================================================================

-- Step 1: Show what will be created (review this first)
WITH today_range AS (
  SELECT 
    date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York' as today_start,
    date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York' + interval '1 day' as today_end
),
-- Step 2: Find all calls today with duration > 900s (15 minutes) - potential instant presentations
potential_instant_presentations AS (
  SELECT 
    tcl.twilio_call_sid,
    tcl.owner_email as agent_email,
    REGEXP_REPLACE(tcl.to_number, '[^0-9]', '', 'g') as lead_phone,
    tcl.call_duration,
    tcl.call_status,
    tcl.call_started_at,
    tcl.call_ended_at
  FROM twilio_call_logs tcl, today_range tr
  WHERE tcl.call_started_at >= tr.today_start
    AND tcl.call_started_at < tr.today_end
    AND tcl.owner_email IS NOT NULL
    AND tcl.owner_email != ''
    AND tcl.call_direction = 'outbound'
    AND tcl.call_duration IS NOT NULL
    AND tcl.call_duration > 900  -- Over 15 minutes
    AND tcl.to_number IS NOT NULL
    AND tcl.to_number != ''
    AND LOWER(COALESCE(tcl.call_status, '')) IN ('answered', 'completed', 'in-progress')
),
-- Step 3: Check which ones already have instant_presentation events
existing_instant_presentations AS (
  SELECT DISTINCT
    adm.lead_phone,
    adm.call_sid,
    adm.agent_email
  FROM agent_dial_metrics adm, today_range tr
  WHERE adm.event_timestamp >= tr.today_start
    AND adm.event_timestamp < tr.today_end
    AND (
      LOWER(adm.event_type) = 'instant_presentation'
      OR LOWER(COALESCE(adm.disposition, '')) = 'instant_presentation'
    )
),
-- Step 4: Find missing ones (calls without instant_presentation events)
missing_instant_presentations AS (
  SELECT 
    pip.twilio_call_sid,
    pip.agent_email,
    pip.lead_phone,
    pip.call_duration,
    pip.call_status,
    pip.call_started_at
  FROM potential_instant_presentations pip
  WHERE NOT EXISTS (
    SELECT 1 
    FROM existing_instant_presentations eip
    WHERE eip.agent_email = pip.agent_email
      AND eip.lead_phone = pip.lead_phone
      AND eip.call_sid = pip.twilio_call_sid
  )
  -- Also exclude if there's already a booked event (to avoid duplicates)
  AND NOT EXISTS (
    SELECT 1
    FROM agent_dial_metrics adm, today_range tr
    WHERE adm.agent_email = pip.agent_email
      AND adm.lead_phone = pip.lead_phone
      AND adm.call_sid = pip.twilio_call_sid
      AND adm.event_timestamp >= tr.today_start
      AND adm.event_timestamp < tr.today_end
      AND (
        LOWER(adm.event_type) = 'booked'
        OR LOWER(COALESCE(adm.disposition, '')) = 'booked'
      )
  )
)
SELECT 
  'PREVIEW: Calls that will get instant_presentation events' as action,
  COUNT(*) as total_to_create,
  COUNT(DISTINCT agent_email) as distinct_agents
FROM missing_instant_presentations;

-- Step 5: Show detailed preview
WITH today_range AS (
  SELECT 
    date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York' as today_start,
    date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York' + interval '1 day' as today_end
),
potential_instant_presentations AS (
  SELECT 
    tcl.twilio_call_sid,
    tcl.owner_email as agent_email,
    REGEXP_REPLACE(tcl.to_number, '[^0-9]', '', 'g') as lead_phone,
    tcl.call_duration,
    tcl.call_status,
    tcl.call_started_at
  FROM twilio_call_logs tcl, today_range tr
  WHERE tcl.call_started_at >= tr.today_start
    AND tcl.call_started_at < tr.today_end
    AND tcl.owner_email IS NOT NULL
    AND tcl.owner_email != ''
    AND tcl.call_direction = 'outbound'
    AND tcl.call_duration IS NOT NULL
    AND tcl.call_duration > 900
    AND tcl.to_number IS NOT NULL
    AND tcl.to_number != ''
    AND LOWER(COALESCE(tcl.call_status, '')) IN ('answered', 'completed', 'in-progress')
),
existing_instant_presentations AS (
  SELECT DISTINCT
    adm.lead_phone,
    adm.call_sid,
    adm.agent_email
  FROM agent_dial_metrics adm, today_range tr
  WHERE adm.event_timestamp >= tr.today_start
    AND adm.event_timestamp < tr.today_end
    AND (
      LOWER(adm.event_type) = 'instant_presentation'
      OR LOWER(COALESCE(adm.disposition, '')) = 'instant_presentation'
    )
),
missing_instant_presentations AS (
  SELECT 
    pip.twilio_call_sid,
    pip.agent_email,
    pip.lead_phone,
    pip.call_duration,
    pip.call_status,
    pip.call_started_at
  FROM potential_instant_presentations pip
  WHERE NOT EXISTS (
    SELECT 1 
    FROM existing_instant_presentations eip
    WHERE eip.agent_email = pip.agent_email
      AND eip.lead_phone = pip.lead_phone
      AND eip.call_sid = pip.twilio_call_sid
  )
  AND NOT EXISTS (
    SELECT 1
    FROM agent_dial_metrics adm, today_range tr
    WHERE adm.agent_email = pip.agent_email
      AND adm.lead_phone = pip.lead_phone
      AND adm.call_sid = pip.twilio_call_sid
      AND adm.event_timestamp >= tr.today_start
      AND adm.event_timestamp < tr.today_end
      AND (
        LOWER(adm.event_type) = 'booked'
        OR LOWER(COALESCE(adm.disposition, '')) = 'booked'
      )
  )
)
SELECT 
  twilio_call_sid,
  agent_email,
  lead_phone,
  call_duration,
  ROUND(call_duration / 60.0, 1) as duration_minutes,
  call_status,
  call_started_at
FROM missing_instant_presentations
ORDER BY call_duration DESC;

-- ============================================================================
-- AFTER REVIEWING THE ABOVE, RUN THE ACTUAL BACKFILL:
-- ============================================================================

-- ============================================================================
-- STEP 5.5: Fix CHECK constraint to allow 'instant_presentation' event_type
-- ============================================================================
-- CRITICAL: This MUST execute before the INSERT below
-- Drop the old constraint
DO $$
-BEGIN
-  ALTER TABLE agent_dial_metrics 
-  DROP CONSTRAINT IF EXISTS agent_dial_metrics_event_type_check;
-  
-  ALTER TABLE agent_dial_metrics 
-  ADD CONSTRAINT agent_dial_metrics_event_type_check 
-  CHECK (event_type IN ('dial', 'reach', 'booked', 'instant_presentation'));
-  
-  RAISE NOTICE '✅ Constraint updated to allow instant_presentation';
-EXCEPTION WHEN OTHERS THEN
-  RAISE EXCEPTION '❌ Failed to update constraint: %', SQLERRM;
-END $$;

-- Step 6: INSERT missing instant_presentation events
WITH today_range AS (
  SELECT 
    date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York' as today_start,
    date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York' + interval '1 day' as today_end
),
potential_instant_presentations AS (
  SELECT 
    tcl.twilio_call_sid,
    tcl.owner_email as agent_email,
    REGEXP_REPLACE(tcl.to_number, '[^0-9]', '', 'g') as lead_phone,
    tcl.call_duration,
    tcl.call_status,
    tcl.call_started_at
  FROM twilio_call_logs tcl, today_range tr
  WHERE tcl.call_started_at >= tr.today_start
    AND tcl.call_started_at < tr.today_end
    AND tcl.owner_email IS NOT NULL
    AND tcl.owner_email != ''
    AND tcl.call_direction = 'outbound'
    AND tcl.call_duration IS NOT NULL
    AND tcl.call_duration > 900
    AND tcl.to_number IS NOT NULL
    AND tcl.to_number != ''
    AND LOWER(COALESCE(tcl.call_status, '')) IN ('answered', 'completed', 'in-progress')
),
existing_instant_presentations AS (
  SELECT DISTINCT
    adm.lead_phone,
    adm.call_sid,
    adm.agent_email
  FROM agent_dial_metrics adm, today_range tr
  WHERE adm.event_timestamp >= tr.today_start
    AND adm.event_timestamp < tr.today_end
    AND (
      LOWER(adm.event_type) = 'instant_presentation'
      OR LOWER(COALESCE(adm.disposition, '')) = 'instant_presentation'
    )
),
missing_instant_presentations AS (
  SELECT 
    pip.twilio_call_sid,
    pip.agent_email,
    pip.lead_phone,
    pip.call_duration,
    pip.call_status,
    pip.call_started_at
  FROM potential_instant_presentations pip
  WHERE NOT EXISTS (
    SELECT 1 
    FROM existing_instant_presentations eip
    WHERE eip.agent_email = pip.agent_email
      AND eip.lead_phone = pip.lead_phone
      AND eip.call_sid = pip.twilio_call_sid
  )
  AND NOT EXISTS (
    SELECT 1
    FROM agent_dial_metrics adm, today_range tr
    WHERE adm.agent_email = pip.agent_email
      AND adm.lead_phone = pip.lead_phone
      AND adm.call_sid = pip.twilio_call_sid
      AND adm.event_timestamp >= tr.today_start
      AND adm.event_timestamp < tr.today_end
      AND (
        LOWER(adm.event_type) = 'booked'
        OR LOWER(COALESCE(adm.disposition, '')) = 'booked'
      )
  )
)
INSERT INTO agent_dial_metrics (
  agent_email,
  lead_phone,
  call_sid,
  call_duration,
  call_status,
  event_type,
  disposition,
  event_timestamp
)
SELECT 
  agent_email,
  lead_phone,
  twilio_call_sid,
  call_duration,
  call_status,
  'instant_presentation' as event_type,
  'instant_presentation' as disposition,
  COALESCE(call_started_at, now()) as event_timestamp
FROM missing_instant_presentations
ON CONFLICT DO NOTHING;  -- Prevent duplicates if somehow they exist

-- Step 7: Verify what was created
SELECT 
  'VERIFICATION: Instant presentations created today' as check_type,
  COUNT(*) as total_created,
  COUNT(DISTINCT agent_email) as distinct_agents,
  COUNT(DISTINCT lead_phone) as distinct_phones
FROM agent_dial_metrics adm
WHERE adm.event_timestamp >= date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York'
  AND adm.event_timestamp < date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York' + interval '1 day'
  AND (
    LOWER(adm.event_type) = 'instant_presentation'
    OR LOWER(COALESCE(adm.disposition, '')) = 'instant_presentation'
  );

-- Step 8: Recalculate live call board stats for all affected agents
SELECT 
  'RECALCULATING STATS FOR AFFECTED AGENTS' as action,
  update_live_call_boardt_stats_from_metrics() as result;

-- Step 9: Show updated stats
SELECT 
  agent_email,
  today_dialed,
  today_reached,
  today_booked,
  today_instant_presentation,
  updated_at
FROM live_call_boardt
WHERE agent_email IN (
  SELECT DISTINCT owner_email
  FROM twilio_call_logs
  WHERE call_started_at >= date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York'
    AND call_started_at < date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York' + interval '1 day'
    AND call_duration > 900
    AND owner_email IS NOT NULL
)
ORDER BY today_instant_presentation DESC, today_booked DESC;
