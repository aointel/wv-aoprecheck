-- Create table to store Taalk VDP campaigns locally

CREATE TABLE IF NOT EXISTS taalk_campaigns (
  id TEXT PRIMARY KEY, -- Taalk campaign ID (_id from Taalk API)
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active', -- active, paused, archived
  
  -- Campaign configuration
  persona_id TEXT,
  script_id TEXT,
  campaign_type TEXT, -- VDP, outbound, etc.
  
  -- Stats (calculated from our data)
  total_agents INTEGER DEFAULT 0,
  active_agents INTEGER DEFAULT 0,
  total_calls INTEGER DEFAULT 0,
  
  -- Metadata
  taalk_data JSONB, -- Store full Taalk response for reference
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_taalk_campaigns_status ON taalk_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_taalk_campaigns_updated ON taalk_campaigns(updated_at);

-- Comments
COMMENT ON TABLE taalk_campaigns IS 'Synced from Taalk API - VDP campaign data for management UI';
COMMENT ON COLUMN taalk_campaigns.taalk_data IS 'Full JSON response from Taalk API for reference';

