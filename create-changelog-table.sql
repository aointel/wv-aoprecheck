-- =====================================================
-- Changelog System for AOI
-- =====================================================
-- Stores changelog entries and tracks which users have seen them

-- Changelog entries table
CREATE TABLE IF NOT EXISTS changelog_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL, -- e.g., "1.2.0", "2024-11-23"
  title TEXT NOT NULL,
  description TEXT, -- Optional longer description
  items JSONB DEFAULT '[]', -- Array of changelog items: [{"type": "feature", "text": "..."}, ...]
  priority TEXT DEFAULT 'normal', -- 'low', 'normal', 'high', 'critical'
  published_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ, -- Optional expiration date
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Track which users have seen which changelog entries
CREATE TABLE IF NOT EXISTS changelog_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_email TEXT NOT NULL,
  changelog_entry_id UUID REFERENCES changelog_entries(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT NOW(),
  dismissed BOOLEAN DEFAULT false,
  dismissed_at TIMESTAMPTZ,
  UNIQUE(agent_email, changelog_entry_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_changelog_entries_published ON changelog_entries(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_changelog_entries_priority ON changelog_entries(priority, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_changelog_views_agent ON changelog_views(agent_email, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_changelog_views_entry ON changelog_views(changelog_entry_id);

-- Disable RLS (or create permissive policies)
ALTER TABLE changelog_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE changelog_views DISABLE ROW LEVEL SECURITY;

-- Sample changelog entry
INSERT INTO changelog_entries (version, title, description, items, priority) VALUES
(
  '2024-11-23',
  'Enhanced Notification System',
  'We''ve completely rebuilt the notification system with real-time updates and better organization.',
  '[
    {"type": "feature", "text": "Real-time notification updates"},
    {"type": "improvement", "text": "Better notification filtering (All, Unread, Urgent)"},
    {"type": "improvement", "text": "Clickable notifications with action links"},
    {"type": "improvement", "text": "Visual icons and color coding by notification type"},
    {"type": "improvement", "text": "Relative timestamps (e.g., ''5m ago'')"}
  ]'::jsonb,
  'high'
);

