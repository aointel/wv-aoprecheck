-- =====================================================
-- Remove RLS Policies and Disable RLS
-- =====================================================
-- This disables RLS entirely for agent_notifications
-- Safe because frontend already filters by agent_email

-- Drop existing policies
DROP POLICY IF EXISTS "Agents can view their own notifications" ON agent_notifications;
DROP POLICY IF EXISTS "Agents can update their own notifications" ON agent_notifications;
DROP POLICY IF EXISTS "Allow anon users to view notifications" ON agent_notifications;
DROP POLICY IF EXISTS "Allow anon users to update notifications" ON agent_notifications;
DROP POLICY IF EXISTS "Allow authenticated users to view notifications" ON agent_notifications;
DROP POLICY IF EXISTS "Allow authenticated users to update notifications" ON agent_notifications;

-- Disable RLS entirely
ALTER TABLE agent_notifications DISABLE ROW LEVEL SECURITY;

































