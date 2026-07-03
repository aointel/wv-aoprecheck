-- ============================================================================
-- ⚠️  CRITICAL: RUN THIS FIRST BEFORE BACKFILLING INSTANT PRESENTATIONS ⚠️
-- ============================================================================
-- 
-- This fixes the CHECK constraint on agent_dial_metrics.event_type
-- The constraint currently only allows: 'dial', 'reach', 'booked'
-- We need to add 'instant_presentation' to allow instant presentation events
--
-- YOU MUST RUN THIS BEFORE running backfill-instant-presentations-today.sql
-- ============================================================================

-- Step 1: Drop the old constraint
ALTER TABLE agent_dial_metrics 
DROP CONSTRAINT IF EXISTS agent_dial_metrics_event_type_check;

-- Step 2: Add new constraint that includes 'instant_presentation'
ALTER TABLE agent_dial_metrics 
ADD CONSTRAINT agent_dial_metrics_event_type_check 
CHECK (event_type IN ('dial', 'reach', 'booked', 'instant_presentation'));

-- Step 3: Verify the constraint was updated
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conname = 'agent_dial_metrics_event_type_check'
  AND conrelid = 'agent_dial_metrics'::regclass;

-- Expected output should show:
-- constraint_name: agent_dial_metrics_event_type_check
-- constraint_definition: CHECK (event_type = ANY (ARRAY['dial'::text, 'reach'::text, 'booked'::text, 'instant_presentation'::text]))
