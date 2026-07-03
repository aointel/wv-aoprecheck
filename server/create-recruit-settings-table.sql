-- Create recruit_user_settings table for AO Recruit pipeline customization
CREATE TABLE IF NOT EXISTS recruit_user_settings (
  id SERIAL PRIMARY KEY,
  agent_email TEXT NOT NULL UNIQUE,
  -- Pipeline order customization - JSON array of stage IDs in custom order
  pipeline_order JSONB,
  -- Custom stage names - JSON object mapping stage ID to custom name
  custom_stage_names JSONB,
  -- URL customizations for specific stages
  virtual_overview_url TEXT,
  group_final_url TEXT,
  final_interview_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add custom_stage_names column if it doesn't exist (for existing tables)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'recruit_user_settings' 
    AND column_name = 'custom_stage_names'
  ) THEN
    ALTER TABLE recruit_user_settings ADD COLUMN custom_stage_names JSONB;
  END IF;
END $$;

-- Add stage_urls column if it doesn't exist (for existing tables)
-- This replaces the individual URL columns (virtual_overview_url, group_final_url, final_interview_url)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'recruit_user_settings' 
    AND column_name = 'stage_urls'
  ) THEN
    ALTER TABLE recruit_user_settings ADD COLUMN stage_urls JSONB;
  END IF;
END $$;

-- Create index on agent_email for faster lookups
CREATE INDEX IF NOT EXISTS idx_recruit_user_settings_agent_email ON recruit_user_settings(agent_email);

-- Add comment
COMMENT ON TABLE recruit_user_settings IS 'Stores user-specific pipeline order and URL customizations for AO Recruit';

