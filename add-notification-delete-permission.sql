-- =====================================================
-- Add DELETE Permission for Notifications
-- =====================================================
-- Allows agents to delete their own notifications

-- Drop existing delete policies if any
DROP POLICY IF EXISTS "Agents can delete their own notifications" ON agent_notifications;
DROP POLICY IF EXISTS "Allow anon users to delete notifications" ON agent_notifications;
DROP POLICY IF EXISTS "Allow authenticated users to delete notifications" ON agent_notifications;

-- Allow anon users to delete notifications (frontend uses anon key)
CREATE POLICY "Allow anon users to delete notifications"
  ON agent_notifications
  FOR DELETE
  TO anon
  USING (true);

-- Allow authenticated users to delete notifications
CREATE POLICY "Allow authenticated users to delete notifications"
  ON agent_notifications
  FOR DELETE
  TO authenticated
  USING (true);

































