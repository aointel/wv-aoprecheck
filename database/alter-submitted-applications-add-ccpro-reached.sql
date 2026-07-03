-- Allow transfer_type = 'ccpro_reached' (matched to agent_dial_metrics event_type = 'reach' — 45+ sec, transferred).
-- Run in Supabase SQL editor if your table has the original CHECK constraint.

ALTER TABLE submitted_applications
  DROP CONSTRAINT IF EXISTS submitted_applications_transfer_type_check;

ALTER TABLE submitted_applications
  ADD CONSTRAINT submitted_applications_transfer_type_check
  CHECK (transfer_type IS NULL OR transfer_type IN ('aoi_connect', 'ccpro_booked', 'ccpro_reached'));

COMMENT ON COLUMN submitted_applications.transfer_type IS 'aoi_connect = billing_transactions connect; ccpro_booked = agent_dial_metrics booked; ccpro_reached = agent_dial_metrics reach (45+ sec, transferred).';
