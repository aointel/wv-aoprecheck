-- FIX: Add 'instant_presentation' to agent_dial_metrics event_type constraint
-- This allows logging instant_presentation events to the table

-- Drop the old constraint
ALTER TABLE agent_dial_metrics 
DROP CONSTRAINT IF EXISTS agent_dial_metrics_event_type_check;

-- Add the new constraint with instant_presentation included
ALTER TABLE agent_dial_metrics 
ADD CONSTRAINT agent_dial_metrics_event_type_check 
CHECK (event_type IN ('dial', 'reach', 'booked', 'instant_presentation'));

-- Verify the constraint was updated
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'agent_dial_metrics'::regclass
    AND conname = 'agent_dial_metrics_event_type_check';
