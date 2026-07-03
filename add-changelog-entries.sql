-- =====================================================
-- Add Demo Changelog Entries
-- =====================================================
-- User-friendly changelog entries based on recent improvements

-- Clear any existing test entries (optional)
-- DELETE FROM changelog_entries WHERE version LIKE '2024-11-%';

-- Entry 1: Enhanced Notification System (Most Recent)
INSERT INTO changelog_entries (version, title, description, items, priority, published_at) VALUES
(
  '2024-11-23',
  '✨ Enhanced Notification System',
  'We''ve completely rebuilt the notification system to keep you better informed about important updates and activities.',
  '[
    {"type": "feature", "text": "Real-time updates - see new notifications instantly without refreshing"},
    {"type": "improvement", "text": "Smart filtering - quickly view All, Unread, or Urgent notifications"},
    {"type": "improvement", "text": "Clickable notifications - tap any notification to jump directly to the related page"},
    {"type": "improvement", "text": "Better organization - color-coded icons help you identify notification types at a glance"},
    {"type": "improvement", "text": "Easy-to-read timestamps - see ''5 minutes ago'' instead of long dates"}
  ]'::jsonb,
  'high',
  NOW() - INTERVAL '1 day'
);

-- Entry 2: Call Connector Pro Improvements
INSERT INTO changelog_entries (version, title, description, items, priority, published_at) VALUES
(
  '2024-11-22',
  '🚀 Call Connector Pro Updates',
  'Major improvements to help you work more efficiently and manage your leads better.',
  '[
    {"type": "feature", "text": "New Leads Alert - get a popup notification when fresh leads are assigned to you"},
    {"type": "improvement", "text": "Better lead filtering - only see callable leads (pending status)"},
    {"type": "improvement", "text": "Optimized refresh rates - faster updates when actively dialing, less frequent when idle"},
    {"type": "improvement", "text": "Auto-assignment - system automatically requests more leads when your queue gets low"},
    {"type": "bugfix", "text": "Fixed lead display issues - leads now show correctly in your queue"}
  ]'::jsonb,
  'high',
  NOW() - INTERVAL '2 days'
);

-- Entry 3: Calendar & Appointment Improvements
INSERT INTO changelog_entries (version, title, description, items, priority, published_at) VALUES
(
  '2024-11-21',
  '📅 Calendar & Appointment System Updates',
  'Better timezone support and appointment scheduling to help you stay organized.',
  '[
    {"type": "feature", "text": "Timezone selector - view and schedule appointments in your local timezone"},
    {"type": "bugfix", "text": "Fixed calendar day display - dates now show correctly (no more off-by-one day issues)"},
    {"type": "improvement", "text": "Better validation - system now prompts you to schedule an appointment when marking a call as ''booked''"},
    {"type": "improvement", "text": "Improved calendar sync - appointments display correctly regardless of your timezone"}
  ]'::jsonb,
  'normal',
  NOW() - INTERVAL '3 days'
);

-- Entry 4: Audio Center Improvements
INSERT INTO changelog_entries (version, title, description, items, priority, published_at) VALUES
(
  '2024-11-20',
  '🎤 Audio Center Enhancements',
  'Improved microphone testing so you can verify your audio setup is working correctly before calls.',
  '[
    {"type": "improvement", "text": "Better mic wave visualization - see your voice levels in real-time as you speak"},
    {"type": "bugfix", "text": "Fixed mic test - audio levels now display correctly (no more thinking your mic is broken)"},
    {"type": "improvement", "text": "More accurate voice detection - better visualization of your actual voice levels"}
  ]'::jsonb,
  'normal',
  NOW() - INTERVAL '4 days'
);

-- Entry 5: Billing Dashboard Improvements
INSERT INTO changelog_entries (version, title, description, items, priority, published_at) VALUES
(
  '2024-11-19',
  '💳 Billing Dashboard Updates',
  'Better visibility into your billing, credits, and subscription management.',
  '[
    {"type": "improvement", "text": "New tabbed layout - Overview, Billing Details, and Subscription tabs"},
    {"type": "improvement", "text": "Auto-refresh - billing data updates automatically every 30 seconds"},
    {"type": "feature", "text": "Subscription management - easily view and manage your Call Connector Pro subscription"},
    {"type": "improvement", "text": "Better organization - Service Pricing moved to top for easy access"}
  ]'::jsonb,
  'normal',
  NOW() - INTERVAL '5 days'
);

-- Entry 6: Lead Management Improvements
INSERT INTO changelog_entries (version, title, description, items, priority, published_at) VALUES
(
  '2024-11-18',
  '📋 Lead Management Enhancements',
  'Smarter lead handling and better organization of your call queue.',
  '[
    {"type": "improvement", "text": "HotLeads prioritization - hot leads now appear at the top of your queue"},
    {"type": "improvement", "text": "Better filtering - called leads are automatically filtered out"},
    {"type": "improvement", "text": "Auto-assignment - system automatically requests more leads when your queue drops below 10"},
    {"type": "bugfix", "text": "Fixed lead search - hot leads are now properly identified in search results"}
  ]'::jsonb,
  'normal',
  NOW() - INTERVAL '6 days'
);

-- Entry 7: What's New Feature (Meta)
INSERT INTO changelog_entries (version, title, description, items, priority, published_at) VALUES
(
  '2024-11-23',
  'New: Changelog System',
  'Stay up to date with all the latest improvements and new features!',
  '[
    {"type": "feature", "text": "New ''What''s New'' button in the header (sparkles icon)"},
    {"type": "feature", "text": "Automatic popup on login when there are new updates"},
    {"type": "improvement", "text": "Easy-to-read format with icons and priority badges"},
    {"type": "improvement", "text": "Dismiss updates you''ve already seen"}
  ]'::jsonb,
  'normal',
  NOW()
);

-- Verify entries were created
SELECT 
  version,
  title,
  priority,
  published_at,
  jsonb_array_length(items) as item_count
FROM changelog_entries
ORDER BY published_at DESC;

