-- Migration: Add outcome tracking fields to appointments table
-- Run this against the Supabase appointments table

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS outcome text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS outcome_notes text,
  ADD COLUMN IF NOT EXISTS outcome_at timestamptz,
  ADD COLUMN IF NOT EXISTS disposition_source text,
  ADD COLUMN IF NOT EXISTS lead_market text,
  ADD COLUMN IF NOT EXISTS meeting_link text,
  ADD COLUMN IF NOT EXISTS meeting_data jsonb,
  ADD COLUMN IF NOT EXISTS reminders_sent integer DEFAULT 0;

-- outcome values: 'pending' | 'sale' | 'no_show' | 'rescheduled' | 'not_interested' | 'policy_issued' | 'cancelled'
-- disposition_source values: 'booked' | 'instant_presentation'

COMMENT ON COLUMN appointments.outcome IS 'Appointment outcome: pending, sale, no_show, rescheduled, not_interested, policy_issued, cancelled';
COMMENT ON COLUMN appointments.outcome_notes IS 'Optional notes about the outcome';
COMMENT ON COLUMN appointments.outcome_at IS 'UTC timestamp when the outcome was recorded';
COMMENT ON COLUMN appointments.disposition_source IS 'How the appointment was created: booked or instant_presentation';
COMMENT ON COLUMN appointments.lead_market IS 'Lead market at booking time, for example Veteran or Globe Market';
COMMENT ON COLUMN appointments.meeting_link IS 'Generic meeting URL used by the appointment and reminder UI';
COMMENT ON COLUMN appointments.meeting_data IS 'Optional structured meeting payload from the booking UI';
