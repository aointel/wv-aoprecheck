-- ============================================================================
-- FIX agent_dial_metrics CHECK CONSTRAINT
-- 
-- The constraint currently only allows: 'dial', 'reach', 'booked'
-- We need to add 'instant_presentation' to allow instant presentation events
-- ============================================================================

-- Step 1: Drop the old constraint
ALTER TABLE agent_dial_metrics 
DROP CONSTRAINT IF EXISTS agent_dial_metrics_event_type_check;

-- Step 2: Add new constraint that includes 'instant_presentation'
ALTER TABLE agent_dial_metrics 
ADD CONSTRAINT agent_dial_metrics_event_type_check 
CHECK (event_type IN ('dial', 'reach', 'booked', 'instant_presentation'));

-- Step 3: Verify the constraint
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conname = 'agent_dial_metrics_event_type_check'
  AND conrelid = 'agent_dial_metrics'::regclass;
