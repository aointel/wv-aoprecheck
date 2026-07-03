-- =====================================================
-- Fix RLS Policies for agent_notifications
-- =====================================================
-- The current RLS policies require Supabase Auth, but the app
-- uses a different auth system. This updates the policies to
-- allow access when using the anon key.

-- Drop existing policies
DROP POLICY IF EXISTS "Agents can view their own notifications" ON agent_notifications;
DROP POLICY IF EXISTS "Agents can update their own notifications" ON agent_notifications;

-- Option 1: More permissive policy for authenticated users
-- This allows any authenticated user to see notifications
-- (You'll need to pass the email in a different way or use service role)
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

-- Option 2: Allow anon access (for testing/development)
-- WARNING: This allows anyone to see any notification if they know the email
-- Only use this if you're passing the email in the query somehow
CREATE POLICY "Allow anon users to view notifications"
  ON agent_notifications
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon users to update notifications"
  ON agent_notifications
  FOR UPDATE
  TO anon
  USING (true);

-- Option 3: Disable RLS temporarily (NOT RECOMMENDED FOR PRODUCTION)
-- ALTER TABLE agent_notifications DISABLE ROW LEVEL SECURITY;

































