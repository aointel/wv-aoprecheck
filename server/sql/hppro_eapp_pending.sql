-- Queue: HPPRO SyncPresentation completion → browser polls → POST http://127.0.0.1:7432/inject-next (EappSync.exe)
CREATE TABLE IF NOT EXISTS public.hppro_eapp_pending (
  id                BIGSERIAL PRIMARY KEY,
  agent_email       TEXT NOT NULL,
  presentation_guid TEXT NOT NULL,
  inject_payload    JSONB NOT NULL,
  what_happened     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  consumed_at       TIMESTAMPTZ,
  UNIQUE (agent_email, presentation_guid)
);

CREATE INDEX IF NOT EXISTS idx_hppro_eapp_pending_open
  ON public.hppro_eapp_pending (agent_email)
  WHERE consumed_at IS NULL;
