-- =====================================================
-- Cleanup and Update Changelog - Keep Only Recent Relevant Entries
-- =====================================================
-- This script removes old entries and keeps only the most recent, relevant updates

-- Clear all existing changelog entries (start fresh)
DELETE FROM changelog_entries;

-- Also clear all views (so everyone sees the new entries)
DELETE FROM changelog_views;

-- Entry 1: Live Call Board Updates (Most Recent - Today)
INSERT INTO changelog_entries (version, title, description, items, priority, published_at) VALUES
(
  TO_CHAR(NOW(), 'YYYY-MM-DD'),
  '📊 Live Call Board Updates & Improvements',
  'Enhanced Live Call Board access and filtering for better team management.',
  '[
    {"type": "feature", "text": "Live Call Board now accessible to all MGA/RGA users"},
    {"type": "improvement", "text": "Managers can now see only their team members in Live Call Board"},
    {"type": "improvement", "text": "Removed hotleads popup notification for cleaner experience"}
  ]'::jsonb,
  'normal',
  NOW()
);

-- Entry 2: Notification System (Keep this as it's still relevant)
INSERT INTO changelog_entries (version, title, description, items, priority, published_at) VALUES
(
  TO_CHAR(NOW() - INTERVAL '1 day', 'YYYY-MM-DD'),
  '🔔 Notification System is Live',
  'Stay informed about important updates and activities in real-time.',
  '[
    {"type": "feature", "text": "Real-time notifications for missed calls, charged calls, and added credits"},
    {"type": "feature", "text": "Upcoming appointment reminders"},
    {"type": "feature", "text": "Alerts for connects and leads that need resolution"},
    {"type": "improvement", "text": "Sound alerts and visual notifications keep you informed"},
    {"type": "improvement", "text": "Easy dismissal - click Got it or tap the notification to dismiss"}
  ]'::jsonb,
  'high',
  NOW() - INTERVAL '1 day'
);

-- Verify entries were created correctly
SELECT
  id,
  version,
  title,
  priority,
  published_at,
  jsonb_array_length(items) as item_count,
  TO_CHAR(published_at, 'Month DD, YYYY') as formatted_date
FROM changelog_entries
ORDER BY published_at DESC;
