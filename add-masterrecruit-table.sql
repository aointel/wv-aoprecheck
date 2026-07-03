-- Create masterrecruit table - unassigned/follow-up candidate queue (like masterlead for recruits).
-- Mirrors recruit_candidates; agents "convert" rows to recruit_candidates when they take ownership.
-- Run this in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS masterrecruit (
  id BIGSERIAL PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  position TEXT,
  experience TEXT,
  rating NUMERIC(3,1),
  notes TEXT,
  ai_summary TEXT,
  agent_id TEXT,
  agent_email TEXT,
  appointment_date TIMESTAMPTZ,
  appointment_notes TEXT,
  current_stage_id INTEGER,
  stage_entered_at TIMESTAMPTZ,
  last_contacted TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE masterrecruit IS 'Unassigned/follow-up recruit candidates; agents convert to recruit_candidates when taking ownership';
