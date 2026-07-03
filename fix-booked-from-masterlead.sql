-- Fix booked dispositions: Update dial events with valid duration (> 240s) to booked
-- for leads that are marked as booked in masterlead but don't have booked events in agent_dial_metrics

-- Step 1: Update existing dial events to booked if:
--   - The lead is marked as booked in masterlead
--   - The dial event has duration > 240 seconds
--   - There's no existing valid booked event for that lead

UPDATE agent_dial_metrics adm
SET 
  disposition = 'booked',
  event_type = 'booked'
FROM masterlead ml
WHERE 
  adm.lead_id = ml.id
  AND ml.cnresolution = 'booked'
  AND adm.call_duration > 240
  AND adm.disposition != 'booked'  -- Don't update if already booked
  AND adm.event_type != 'booked'   -- Don't update if already booked
  AND NOT EXISTS (
    -- Don't update if there's already a valid booked event for this lead
    SELECT 1 
    FROM agent_dial_metrics adm2
    WHERE adm2.lead_id = ml.id
      AND (adm2.disposition = 'booked' OR adm2.event_type = 'booked')
      AND adm2.call_duration > 240
      AND adm2.id != adm.id  -- Exclude the current record
  );

-- Step 2: Show summary of what was updated
SELECT 
  COUNT(*) as total_updated,
  COUNT(DISTINCT lead_id) as unique_leads_fixed
FROM agent_dial_metrics
WHERE 
  disposition = 'booked'
  AND event_type = 'booked'
  AND call_duration > 240
  AND updated_at >= NOW() - INTERVAL '1 minute';  -- Only show recently updated
