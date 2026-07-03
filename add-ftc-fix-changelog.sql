-- Add FTC Timezone Fix to Changelog
INSERT INTO changelog_entries (version, title, description, items, priority, published_at) VALUES
(
  '2025-01-15',
  '🕐 Improved Lead Queue - Timezone Compliance Fix',
  'We fixed an issue where leads could get stuck in your queue outside of calling hours. Your lead list now automatically updates based on timezone restrictions.',
  '[
    {"type": "bugfix", "text": "Fixed leads staying in queue outside calling hours - leads now automatically disappear when it''s too early or too late to call in their timezone"},
    {"type": "improvement", "text": "Automatic cache refresh - your lead list updates every hour to respect FTC calling time restrictions"},
    {"type": "improvement", "text": "Better timezone handling - system now correctly filters leads based on their state''s local time (8 AM - 9 PM)"},
    {"type": "info", "text": "Leads will automatically reappear in your queue when calling hours resume in their timezone"}
  ]'::jsonb,
  'normal',
  NOW()
);

-- Add Call Connector Pro Evening Performance Notice
INSERT INTO changelog_entries (version, title, description, items, priority, published_at) VALUES
(
  '2025-01-15',
  '🌙 Call Connector Pro Works Great in the Evening!',
  'After 6 PM PST / 9 PM EST, more leads become available as earlier timezones finish their calling hours. Give it a try!',
  '[
    {"type": "info", "text": "Best performance after 6 PM PST / 9 PM EST - more leads available as East Coast calling hours end"},
    {"type": "improvement", "text": "Better lead availability - system now properly filters leads by timezone, so you get more callable leads in the evening"},
    {"type": "feature", "text": "Automatic timezone compliance - leads automatically appear/disappear based on their state''s calling hours"},
    {"type": "info", "text": "Try Call Connector Pro again in the evening hours - you''ll see more leads available!"}
  ]'::jsonb,
  'high',
  NOW()
);

