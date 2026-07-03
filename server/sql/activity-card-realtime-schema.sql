-- Activity Card + Public Live Hierarchy schema
-- Run in Supabase SQL editor (safe to re-run).

BEGIN;

-- 1) Permanent public links (token + vanity slug)
CREATE TABLE IF NOT EXISTS public.public_hierarchy_links (
  token TEXT PRIMARY KEY,
  scope_key TEXT NOT NULL UNIQUE,
  vanity_slug TEXT UNIQUE,
  manager_email TEXT NOT NULL,
  manager_name TEXT,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_public_hierarchy_links_manager_email
  ON public.public_hierarchy_links(manager_email);
CREATE INDEX IF NOT EXISTS idx_public_hierarchy_links_enabled
  ON public.public_hierarchy_links(enabled);
CREATE UNIQUE INDEX IF NOT EXISTS idx_public_hierarchy_links_vanity_slug
  ON public.public_hierarchy_links(vanity_slug)
  WHERE vanity_slug IS NOT NULL;

-- 2) Fast-read live snapshots per hierarchy
CREATE TABLE IF NOT EXISTS public.hierarchy_live_snapshots (
  scope_key TEXT PRIMARY KEY,
  manager_email TEXT NOT NULL,
  manager_name TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  totals_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  top5_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  bottom5_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  full_rank_json JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_hierarchy_live_snapshots_updated_at
  ON public.hierarchy_live_snapshots(updated_at DESC);

-- 3) Activity card run + delivery logs
CREATE TABLE IF NOT EXISTS public.activity_card_runs (
  id BIGSERIAL PRIMARY KEY,
  scope_key TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/Los_Angeles',
  run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'started',
  generated_image_path TEXT,
  generated_image_url TEXT,
  payload_json JSONB,
  agent_ranks JSONB,
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS public.activity_card_deliveries (
  id BIGSERIAL PRIMARY KEY,
  run_id BIGINT REFERENCES public.activity_card_runs(id) ON DELETE CASCADE,
  recipient_email TEXT,
  recipient_phone TEXT,
  recipient_role TEXT,
  channel TEXT NOT NULL,
  provider_sid TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  error_code TEXT,
  error_message TEXT,
  retry_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4) Performance indexes for realtime aggregation
CREATE INDEX IF NOT EXISTS idx_live_call_boardt_agent_email
  ON public.live_call_boardt(agent_email);
CREATE INDEX IF NOT EXISTS idx_live_call_boardt_updated_at
  ON public.live_call_boardt(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_twilio_call_logs_owner_started
  ON public.twilio_call_logs(owner_email, call_started_at DESC);
CREATE INDEX IF NOT EXISTS idx_twilio_call_logs_started
  ON public.twilio_call_logs(call_started_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_dial_metrics_agent_ts
  ON public.agent_dial_metrics(agent_email, event_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_agent_dial_metrics_type_ts
  ON public.agent_dial_metrics(event_type, event_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_vdp_calls_company_updated
  ON public.vdp_calls(company_email, updated_at DESC);

-- Needed for realtime "missed call" tracking
CREATE INDEX IF NOT EXISTS idx_billing_transactions_type_created
  ON public.billing_transactions(transaction_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_transactions_agent_created
  ON public.billing_transactions(agent_email, created_at DESC);

-- 5) Supabase realtime publication for snapshots
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.hierarchy_live_snapshots;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
  END;
END $$;

COMMIT;

