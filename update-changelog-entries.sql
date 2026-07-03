-- =====================================================
-- Update Changelog Entries - Current Status
-- =====================================================
-- Remove old entries and add current system status

-- Clear existing entries (optional - comment out if you want to keep history)
-- DELETE FROM changelog_entries WHERE version LIKE '2024-11-%';

-- Entry 1: Notification System (Most Recent)
INSERT INTO changelog_entries (version, title, description, items, priority, published_at) VALUES
(
  '2024-12-23',
  '🔔 Notification System is Live',
  'Stay informed about important updates and activities in real-time.',
  '[
    {"type": "feature", "text": "Real-time notifications for missed calls, charged calls, and added credits"},
    {"type": "feature", "text": "Upcoming appointment reminders"},
    {"type": "feature", "text": "Alerts for connects and leads that need resolution"},
    {"type": "improvement", "text": "Sound alerts and visual notifications keep you informed"},
    {"type": "improvement", "text": "Easy dismissal - click "Got it" or tap the notification to dismiss"}
  ]'::jsonb,
  'high',
  NOW()
);

-- Entry 2: AO Reporting System
INSERT INTO changelog_entries (version, title, description, items, priority, published_at) VALUES
(
  '2024-12-23',
  '📊 AO Reporting System is Live',
  'Better tracking and reporting for your appointments and activities.',
  '[
    {"type": "feature", "text": "AO Reporting system is now up and running"},
    {"type": "improvement", "text": "You will be asked to provide a resolution for booked appointments"},
    {"type": "improvement", "text": "When booking appointments, declare the date and time in ConnectNow"}
  ]'::jsonb,
  'high',
  NOW() - INTERVAL '1 day'
);

-- Entry 3: AO Recruit Testing
INSERT INTO changelog_entries (version, title, description, items, priority, published_at) VALUES
(
  '2024-12-23',
  '🧪 AO Recruit Charges in Testing',
  'AO Recruit is currently in testing phase.',
  '[
    {"type": "info", "text": "AO Recruit charges are currently in testing"},
    {"type": "info", "text": "You will NOT be charged for AO Recruit during this testing period"}
  ]'::jsonb,
  'normal',
  NOW() - INTERVAL '2 days'
);

-- Entry 4: Call Connector Pro Improvements
INSERT INTO changelog_entries (version, title, description, items, priority, published_at) VALUES
(
  '2024-12-23',
  '🚀 Call Connector Pro Updates',
  'Major stability and workflow improvements.',
  '[
    {"type": "improvement", "text": "Several stability improvements for better reliability"},
    {"type": "improvement", "text": "Enhanced disposition handling and workflow"},
    {"type": "improvement", "text": "Better error handling and recovery"}
  ]'::jsonb,
  'normal',
  NOW() - INTERVAL '3 days'
);

-- Entry 5: Feedback Request
INSERT INTO changelog_entries (version, title, description, items, priority, published_at) VALUES
(
  '2024-12-23',
  '💬 We Want Your Feedback',
  'Help us improve by reporting any issues you encounter.',
  '[
    {"type": "info", "text": "Please let us know if you run into anything along the way"},
    {"type": "info", "text": "Your feedback helps us improve the system"}
  ]'::jsonb,
  'low',
  NOW() - INTERVAL '4 days'
);

-- Entry 6: Call Connector Pro - Hotleads Update
INSERT INTO changelog_entries (version, title, description, items, priority, published_at) VALUES
(
  '2024-11-27',
  '🔥 Call Connector Pro - Hotleads Update',
  'Improved hotlead distribution for better coverage and evening dialing.',
  '[
    {"type": "improvement", "text": "Hotleads now downloads a more balanced selection of states for better coverage"},
    {"type": "improvement", "text": "Easier to receive and work hotleads after 6 PM PST - system no longer downloads states that are past calling times"}
  ]'::jsonb,
  'high',
  NOW()
);

-- Entry 7: AO Precheck - IP Fraud Detection
INSERT INTO changelog_entries (version, title, description, items, priority, published_at) VALUES
(
  '2024-11-27',
  '🛡️ AO Precheck - Enhanced Fraud Detection',
  'New IP-based fraud detection to ensure verification integrity.',
  '[
    {"type": "feature", "text": "IP location tracking for both agents and clients during precheck verification"},
    {"type": "feature", "text": "Automatic flagging when agent and client are in suspicious proximity (same IP, same city, etc.)"},
    {"type": "improvement", "text": "Admin panel now shows IP analysis flags alongside screenshot and audio analysis"},
    {"type": "info", "text": "Agents do Zoom presentations so should NOT be in the same location as clients - system detects this"}
  ]'::jsonb,
  'high',
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






