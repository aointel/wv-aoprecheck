-- Create support_bookings and support_queue in Supabase
-- Mirrors current Neon schema for AOI Support

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

CREATE TABLE IF NOT EXISTS support_bookings (
  id SERIAL PRIMARY KEY,
  user_email TEXT NOT NULL,
  name TEXT NOT NULL,
  slot_start TIMESTAMPTZ NOT NULL,
  slot_end TIMESTAMPTZ NOT NULL,
  issue_category TEXT NOT NULL DEFAULT 'general',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_bookings_user_email ON support_bookings(LOWER(user_email));
CREATE INDEX IF NOT EXISTS idx_support_bookings_slot_start ON support_bookings(slot_start);
CREATE INDEX IF NOT EXISTS idx_support_queue_status ON support_queue(status);
CREATE INDEX IF NOT EXISTS idx_support_queue_booking_id ON support_queue(booking_id);COMMENT ON TABLE support_bookings IS 'AOI Support 10-min slot bookings. Also written to master_schedule.';
COMMENT ON TABLE support_queue IS 'AOI Support queue for users who joined with a booking.';