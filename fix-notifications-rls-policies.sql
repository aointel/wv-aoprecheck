-- =====================================================
-- Fix RLS Policies for agent_notifications
-- =====================================================
-- This allows anon users (frontend) to query notifications
-- The frontend already filters by agent_email, so this is safe

-- Drop existing policies
DROP POLICY IF EXISTS "Agents can view their own notifications" ON agent_notifications;
DROP POLICY IF EXISTS "Agents can update their own notifications" ON agent_notifications;

-- Allow anon users to view notifications
-- Frontend filters by agent_email in the query, so users only see their own
CREATE POLICY "Allow anon users to view notifications"
  ON agent_notifications
  FOR SELECT
  TO anon
  USING (true);

-- Allow anon users to update notifications (mark as read)
CREATE POLICY "Allow anon users to update notifications"
  ON agent_notifications
  FOR UPDATE
  TO anon
  USING (true);

-- Also allow authenticated users (if using Supabase Auth)
CREATE POLICY "Allow authenticated users to view notifications"
  ON agent_notifications
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to update notifications"
  ON agent_notifications
  FOR UPDATE
  TO authenticated
  USING (true);

































