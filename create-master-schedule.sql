-- Create master_schedule table in Supabase
-- Unified agent schedule: support, meets, appointments, recruit, callbacks
-- Used by countdown timer, TodaysSchedule, and accountability flow

CREATE TABLE IF NOT EXISTS master_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_email TEXT NOT NULL,
  slot_start TIMESTAMPTZ NOT NULL,
  slot_end TIMESTAMPTZ NOT NULL,
  schedule_type TEXT NOT NULL,  -- 'support' | 'meet' | 'appointment' | 'recruit' | 'callback'
  source_table TEXT NOT NULL,   -- 'support_bookings' | 'meets' | 'appointments' | 'recruit_candidates' | 'masterlead'
  source_id TEXT NOT NULL,
  title TEXT,
  description TEXT,
  metadata JSONB DEFAULT '{}',  -- lead name, phone, zoom link, etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_table, source_id)
);

CREATE INDEX IF NOT EXISTS idx_master_schedule_agent_slot ON master_schedule(agent_email, slot_start);
CREATE INDEX IF NOT EXISTS idx_master_schedule_slot_start ON master_schedule(slot_start);
CREATE INDEX IF NOT EXISTS idx_master_schedule_source ON master_schedule(source_table, source_id);

COMMENT ON TABLE master_schedule IS 'Unified agent schedule for support, meets, appointments, recruit. Feeds countdown timer and accountability.';
