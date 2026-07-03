-- App Versions Tracking Table
-- Tracks which agents have which version of the Electron app

CREATE TABLE IF NOT EXISTS app_versions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Agent info
  agent_email VARCHAR(255) NOT NULL,
  agent_name VARCHAR(255),
  
  -- Version info
  app_version VARCHAR(50) NOT NULL, -- e.g. "1.0.3"
  platform VARCHAR(50), -- "win32", "darwin", "linux"
  os_version VARCHAR(100), -- Full OS version string
  
  -- Tracking
  first_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint: one record per agent email
  CONSTRAINT unique_agent_version UNIQUE(agent_email)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_app_versions_email ON app_versions(agent_email);
CREATE INDEX IF NOT EXISTS idx_app_versions_version ON app_versions(app_version);
CREATE INDEX IF NOT EXISTS idx_app_versions_last_seen ON app_versions(last_seen DESC);

-- Enable RLS
ALTER TABLE app_versions ENABLE ROW LEVEL SECURITY;

-- Policy: Allow service role full access
CREATE POLICY "Service role has full access to app_versions"
  ON app_versions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: Authenticated users can read all
CREATE POLICY "Authenticated users can read app_versions"
  ON app_versions
  FOR SELECT
  TO authenticated
  USING (true);

