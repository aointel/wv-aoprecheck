-- Real TaskRouter assignments from Twilio callback (shared across instances).
-- When Twilio POSTs to /api/twilio/taskrouter/assignment we write here so GET /pending sees it on any instance.

CREATE TABLE IF NOT EXISTS taskrouter_pending (
  reservation_sid TEXT PRIMARY KEY,
  task_sid TEXT NOT NULL,
  worker_sid TEXT NOT NULL,
  worker_attributes TEXT NOT NULL DEFAULT '{}',
  task_attributes TEXT NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_taskrouter_pending_created_at ON taskrouter_pending(created_at);
