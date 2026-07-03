-- Add Recent Changes to Changelog
-- Summary of changes from the last 16 hours

INSERT INTO changelog_entries (version, title, description, items, priority, published_at) VALUES
(
  NOW()::date::text,
  '📊 Live Call Board Updates & Improvements',
  'Enhanced Live Call Board access and filtering for better team management.',
  '[
    {"type": "feature", "text": "Live Call Board now accessible to all MGA/RGA users"},
    {"type": "improvement", "text": "Managers can now see only their team members in Live Call Board"},
    {"type": "improvement", "text": "Removed hotleads popup notification for cleaner experience"},
    {"type": "fix", "text": "Refresh button in top header now properly refreshes the entire app"}
  ]'::jsonb,
  'normal',
  NOW()
);
