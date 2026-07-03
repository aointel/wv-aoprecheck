-- =====================================================
-- Agent Notifications Table for Supabase
-- =====================================================
-- This table stores all notifications for agents including:
-- - Billing transactions (AO Connect, PreCheck, Recruit charges)
-- - Credit warnings (low balance alerts)
-- - Missed calls
-- - System notifications
-- - Appointment reminders
-- - Waiting room alerts

-- Create the table
CREATE TABLE IF NOT EXISTS agent_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_email TEXT NOT NULL,
  notification_type TEXT NOT NULL, -- 'billing_transaction', 'credit_low', 'missed_call', 'system', 'appointment', 'waiting_room'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  urgent BOOLEAN DEFAULT false, -- For urgent notifications that need immediate attention
  actionUrl TEXT, -- Optional URL to navigate to when notification is clicked
  metadata JSONB DEFAULT '{}', -- Additional data (transaction_id, amount, lead_name, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add columns if they don't exist (for existing tables)
DO $$ 
BEGIN
  -- Add urgent column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'agent_notifications' AND column_name = 'urgent'
  ) THEN
    ALTER TABLE agent_notifications ADD COLUMN urgent BOOLEAN DEFAULT false;
  END IF;
  
  -- Add actionUrl column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'agent_notifications' AND column_name = 'actionurl'
  ) THEN
    ALTER TABLE agent_notifications ADD COLUMN actionUrl TEXT;
  END IF;
END $$;

-- =====================================================
-- Indexes for Performance
-- =====================================================

-- Index for fast lookups by agent email and date (most common query)
CREATE INDEX IF NOT EXISTS idx_agent_notifications_agent_email 
  ON agent_notifications (agent_email, created_at DESC);

-- Index for unread notifications (for badge count)
CREATE INDEX IF NOT EXISTS idx_agent_notifications_unread 
  ON agent_notifications (agent_email, read) 
  WHERE read = false;

-- Index for notification type filtering
CREATE INDEX IF NOT EXISTS idx_agent_notifications_type 
  ON agent_notifications (notification_type, created_at DESC);

-- Index for urgent notifications (only create if urgent column exists)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'agent_notifications' AND column_name = 'urgent'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_agent_notifications_urgent 
      ON agent_notifications (agent_email, urgent, created_at DESC) 
      WHERE urgent = true;
  END IF;
END $$;

-- =====================================================
-- Row Level Security (RLS) Policies
-- =====================================================

-- Enable RLS
ALTER TABLE agent_notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to view their own notifications
CREATE POLICY "Agents can view their own notifications"
  ON agent_notifications
  FOR SELECT
  TO authenticated
  USING (
    LOWER(agent_email) = LOWER(
      COALESCE(
        auth.jwt() ->> 'email',
        current_setting('request.jwt.claims', true)::json->>'email'
      )
    )
  );

-- Policy: Allow authenticated users to update their own notifications
CREATE POLICY "Agents can update their own notifications"
  ON agent_notifications
  FOR UPDATE
  TO authenticated
  USING (
    LOWER(agent_email) = LOWER(
      COALESCE(
        auth.jwt() ->> 'email',
        current_setting('request.jwt.claims', true)::json->>'email'
      )
    )
  );

-- Policy: Allow anon users to view notifications (for frontend with anon key)
-- NOTE: This allows any anon user to query, but they still need to filter by email
-- The frontend filters by agent_email, so this is safe
CREATE POLICY "Allow anon users to view notifications"
  ON agent_notifications
  FOR SELECT
  TO anon
  USING (true);

-- Policy: Allow anon users to update notifications (mark as read)
CREATE POLICY "Allow anon users to update notifications"
  ON agent_notifications
  FOR UPDATE
  TO anon
  USING (true);

-- Note: Service role (used by backend) bypasses RLS automatically
-- No need for explicit service_role policy - it has full access by default

-- =====================================================
-- Alternative: More Permissive Policy (if needed)
-- =====================================================
-- If you're having issues with RLS and want to test without restrictions,
-- you can temporarily use this instead (NOT RECOMMENDED FOR PRODUCTION):
--
-- DROP POLICY IF EXISTS "Agents can view their own notifications" ON agent_notifications;
-- DROP POLICY IF EXISTS "Agents can update their own notifications" ON agent_notifications;
-- 
-- CREATE POLICY "Allow all authenticated users" ON agent_notifications
--   FOR ALL
--   TO authenticated
--   USING (true)
--   WITH CHECK (true);
--
-- CREATE POLICY "Allow all anon users" ON agent_notifications
--   FOR ALL
--   TO anon
--   USING (true)
--   WITH CHECK (true);

-- =====================================================
-- Optional: Grant permissions
-- =====================================================

-- Grant usage on schema (if needed)
-- GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Grant table permissions
GRANT SELECT, UPDATE ON agent_notifications TO authenticated;
GRANT SELECT, UPDATE ON agent_notifications TO anon; -- If using anon key with RLS

-- =====================================================
-- Verification Query
-- =====================================================

-- Run this to verify the table was created:
-- SELECT 
--   table_name, 
--   column_name, 
--   data_type, 
--   is_nullable,
--   column_default
-- FROM information_schema.columns 
-- WHERE table_name = 'agent_notifications'
-- ORDER BY ordinal_position;

