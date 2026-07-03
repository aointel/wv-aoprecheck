-- support_queue: Live support queue (Geek Squad / Apple Bar style)
-- Users join queue when within their 30-min booking window; staff advance and assign Zoom link

CREATE TABLE IF NOT EXISTS support_queue (
  id SERIAL PRIMARY KEY,
  user_email TEXT NOT NULL,
  name TEXT NOT NULL,
  issue_category TEXT NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  position INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'in_session', 'completed', 'abandoned')),
  zoom_link TEXT,
  booking_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_queue_status ON support_queue(status);
CREATE INDEX IF NOT EXISTS idx_support_queue_user_email ON support_queue(user_email);
CREATE INDEX IF NOT EXISTS idx_support_queue_joined_at ON support_queue(joined_at);

-- support_bookings: 10-minute block bookings for live support
-- User picks slot; can join queue within 30 min before/after

CREATE TABLE IF NOT EXISTS support_bookings (
  id SERIAL PRIMARY KEY,
  user_email TEXT NOT NULL,
  name TEXT NOT NULL,
  slot_start TIMESTAMPTZ NOT NULL,
  slot_end TIMESTAMPTZ NOT NULL,
  issue_category TEXT NOT NULL DEFAULT 'general',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_bookings_user_email ON support_bookings(user_email);
CREATE INDEX IF NOT EXISTS idx_support_bookings_slot_start ON support_bookings(slot_start);
