-- Ensure appointments table exists with all required columns
-- Run this script in Supabase SQL Editor if appointments table is missing

CREATE TABLE IF NOT EXISTS appointments (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  appointment_type TEXT NOT NULL DEFAULT 'consultation',
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  duration INTEGER NOT NULL DEFAULT 60,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  agent_id TEXT NOT NULL,
  agent_email TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  lead_id TEXT,
  lead_name TEXT NOT NULL,
  lead_phone TEXT NOT NULL,
  lead_email TEXT,
  lead_city TEXT,
  lead_state TEXT,
  meeting_platform TEXT NOT NULL DEFAULT 'zoom',
  zoom_meeting_id TEXT,
  zoom_password TEXT,
  zoom_join_url TEXT,
  twilio_room_name TEXT,
  whereby_room_url TEXT,
  whereby_host_room_url TEXT,
  whereby_meeting_id TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled',
  confirmation_status TEXT DEFAULT 'pending',
  reminders_sent INTEGER DEFAULT 0,
  notes TEXT,
  internal_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  cancelled_at TIMESTAMP,
  completed_at TIMESTAMP
);

-- Create index on agent_email for faster queries
CREATE INDEX IF NOT EXISTS idx_appointments_agent_email ON appointments(agent_email);
CREATE INDEX IF NOT EXISTS idx_appointments_start_time ON appointments(start_time);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);

-- Add comment
COMMENT ON TABLE appointments IS 'Appointment scheduling table for AO Intelligence platform';

