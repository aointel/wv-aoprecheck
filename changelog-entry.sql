-- =====================================================
-- Changelog Entry: Call Connector Pro Updates & Improvements
-- =====================================================
-- Insert this into the changelog_entries table in Supabase
-- This will show up when users log in

INSERT INTO changelog_entries (
  version,
  title,
  description,
  items,
  priority,
  published_at
) VALUES (
  '2025-01-15',
  '🚀 What''s New - January 2025',
  'Updates to Call Connector Pro subscriptions, billing management, and call metrics.',
  '[
    {"type": "feature", "text": "Call Connector Pro subscriptions are now available for Globe Market agents - subscribe directly from the video page!"},
    {"type": "feature", "text": "New Stripe Billing Portal: Manage all your subscriptions, change payment methods, and view billing history from the billing dashboard."},
    {"type": "improvement", "text": "More accurate dial counting - your statistics are now more precise and reliable."},
    {"type": "improvement", "text": "Statistics totals now show accurate numbers from all agents, not just the current page."},
    {"type": "feature", "text": "Answering Machine Detection: Outbound calls now detect if answered by human or machine."},
    {"type": "bugfix", "text": "Fixed annoying notifications that appeared after every call - cleaner experience while you work."},
    {"type": "improvement", "text": "All credit purchase buttons now go to the same convenient billing page for consistency."}
  ]'::jsonb,
  'high',
  NOW()
);
