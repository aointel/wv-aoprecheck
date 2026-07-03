-- RUN THIS BEFORE BACKFILLING CLIENT DATA INTO taalk_call_analytics.
-- Adds to_number, lead_name, market, agent_name so the backfill script and API can read/write them.
-- Add denormalized columns to taalk_call_analytics so all reads (transfers list, detail, stats) can use table only.
-- Webhooks + upserts populate these; no joins to twilio_call_logs/masterlead needed for reads.

ALTER TABLE taalk_call_analytics
  ADD COLUMN IF NOT EXISTS to_number TEXT,
  ADD COLUMN IF NOT EXISTS lead_name TEXT,
  ADD COLUMN IF NOT EXISTS market TEXT,
  ADD COLUMN IF NOT EXISTS agent_name TEXT;

CREATE INDEX IF NOT EXISTS idx_taalk_call_analytics_to_number ON taalk_call_analytics(to_number);

COMMENT ON COLUMN taalk_call_analytics.to_number IS 'Lead phone (denormalized from twilio_call_logs)';
COMMENT ON COLUMN taalk_call_analytics.lead_name IS 'Lead first + last name (denormalized from masterlead)';
COMMENT ON COLUMN taalk_call_analytics.market IS 'Taalk market (denormalized from masterlead)';
COMMENT ON COLUMN taalk_call_analytics.agent_name IS 'Agent display name (denormalized from customers)';
