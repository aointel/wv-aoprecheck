-- =====================================================
-- Add Changelog Entry: Missed Call Credits Reversed
-- =====================================================
-- Add entry to notify all users that missed call charges have been credited back

INSERT INTO changelog_entries (version, title, description, items, priority, published_at) VALUES
(
  TO_CHAR(NOW(), 'YYYY-MM-DD'),
  '✅ Missed Call Charges Reversed',
  'We have reversed all incorrectly charged missed call fees. Credits have been added to your account.',
  '[
    {"type": "feature", "text": "All incorrectly charged missed call fees have been reversed"},
    {"type": "feature", "text": "Credits have been automatically added to your purchased credits balance"},
    {"type": "improvement", "text": "You can view the refund transactions in the Billing Center under the Credits tab"},
    {"type": "info", "text": "You will receive a notification with the exact amount credited to your account"}
  ]'::jsonb,
  'high',
  NOW()
);

-- Verify entry was created
SELECT
  version,
  title,
  priority,
  published_at,
  jsonb_array_length(items) as item_count
FROM changelog_entries
WHERE title = '✅ Missed Call Charges Reversed'
ORDER BY published_at DESC
LIMIT 1;

