-- Presentation Tracking System for HPPRO and other presentation tools
-- Tracks all agent presentations with screenshots and analytics

-- 1. Presentation Sessions Table
CREATE TABLE IF NOT EXISTS presentation_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_email VARCHAR(255) NOT NULL,
  agent_name VARCHAR(255),
  associate_id INTEGER,
  
  -- Presentation Details
  presentation_url TEXT NOT NULL,
  presentation_type VARCHAR(50) DEFAULT 'hppro', -- hppro, zoom, meet, etc
  window_title VARCHAR(500),
  
  -- Client Information
  client_name VARCHAR(255),
  client_phone VARCHAR(50),
  client_email VARCHAR(255),
  
  -- Timing
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER,
  
  -- Status
  status VARCHAR(20) DEFAULT 'active', -- active, completed, interrupted
  is_recording BOOLEAN DEFAULT true,
  
  -- Video Recording
  video_url TEXT,
  video_uploaded_at TIMESTAMP WITH TIME ZONE,
  
  -- Analytics (populated after session)
  total_slides_shown INTEGER DEFAULT 0,
  slides_data JSONB, -- Array of slides with timestamps
  ai_summary TEXT, -- AI-generated summary of presentation
  key_topics TEXT[], -- Extracted topics
  engagement_score DECIMAL(3,2), -- 0-1 score
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Presentation Screenshots Table
CREATE TABLE IF NOT EXISTS presentation_screenshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES presentation_sessions(id) ON DELETE CASCADE,
  
  -- Screenshot Details
  screenshot_url TEXT NOT NULL, -- S3/storage URL
  screenshot_data TEXT, -- Base64 if storing inline (for small datasets)
  thumbnail_url TEXT,
  
  -- Timing
  captured_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  sequence_number INTEGER NOT NULL, -- Order in presentation
  time_offset_seconds INTEGER, -- Seconds since presentation start
  
  -- AI Analysis (populated after capture)
  slide_title VARCHAR(500),
  slide_content TEXT, -- Extracted text from OCR
  slide_type VARCHAR(50), -- title, content, pricing, comparison, etc
  detected_products TEXT[], -- Insurance products mentioned
  ai_analysis JSONB, -- Full AI analysis result
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Presentation KPIs Table
CREATE TABLE IF NOT EXISTS presentation_kpis (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES presentation_sessions(id) ON DELETE CASCADE,
  agent_email VARCHAR(255) NOT NULL,
  
  -- Time Metrics
  total_duration_seconds INTEGER,
  active_time_seconds INTEGER, -- Time actually presenting
  idle_time_seconds INTEGER, -- Time paused/inactive
  
  -- Slide Metrics
  total_slides INTEGER DEFAULT 0,
  unique_slides_shown INTEGER DEFAULT 0,
  most_viewed_slide INTEGER, -- Slide number
  average_time_per_slide DECIMAL(10,2),
  
  -- Engagement Metrics
  slide_transitions INTEGER DEFAULT 0, -- How many times they changed slides
  back_navigations INTEGER DEFAULT 0, -- How many times they went back
  presentation_flow_score DECIMAL(3,2), -- 0-1, smooth vs erratic
  
  -- Product Coverage
  products_covered TEXT[], -- Which insurance products were shown
  pricing_slides_shown INTEGER DEFAULT 0,
  comparison_slides_shown INTEGER DEFAULT 0,
  
  -- Completion Metrics
  presentation_completed BOOLEAN DEFAULT false,
  completion_percentage DECIMAL(5,2),
  last_slide_reached INTEGER,
  
  -- Outcome (if known)
  sale_made BOOLEAN,
  client_interest_level VARCHAR(20), -- high, medium, low, none
  follow_up_scheduled BOOLEAN,
  
  -- Metadata
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Live Presentation Tracking (for real-time monitoring)
CREATE TABLE IF NOT EXISTS live_presentations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES presentation_sessions(id) ON DELETE CASCADE,
  agent_email VARCHAR(255) NOT NULL,
  agent_name VARCHAR(255),
  
  -- Real-time State
  current_slide_number INTEGER DEFAULT 1,
  current_slide_title VARCHAR(500),
  current_screenshot_url TEXT,
  last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Manager Viewing
  viewers JSONB DEFAULT '[]'::jsonb, -- Array of manager emails watching
  viewer_count INTEGER DEFAULT 0,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_presentation_sessions_agent ON presentation_sessions(agent_email);
CREATE INDEX IF NOT EXISTS idx_presentation_sessions_date ON presentation_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_presentation_sessions_status ON presentation_sessions(status);
CREATE INDEX IF NOT EXISTS idx_presentation_sessions_associate ON presentation_sessions(associate_id);

CREATE INDEX IF NOT EXISTS idx_presentation_screenshots_session ON presentation_screenshots(session_id);
CREATE INDEX IF NOT EXISTS idx_presentation_screenshots_sequence ON presentation_screenshots(session_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_presentation_screenshots_time ON presentation_screenshots(captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_presentation_kpis_agent ON presentation_kpis(agent_email);
CREATE INDEX IF NOT EXISTS idx_presentation_kpis_session ON presentation_kpis(session_id);
CREATE INDEX IF NOT EXISTS idx_presentation_kpis_date ON presentation_kpis(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_live_presentations_active ON live_presentations(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_live_presentations_agent ON live_presentations(agent_email);

-- Update Triggers
CREATE OR REPLACE FUNCTION update_presentation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_presentation_sessions_updated_at
  BEFORE UPDATE ON presentation_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_presentation_updated_at();

CREATE TRIGGER trigger_update_presentation_kpis_updated_at
  BEFORE UPDATE ON presentation_kpis
  FOR EACH ROW
  EXECUTE FUNCTION update_presentation_updated_at();

CREATE TRIGGER trigger_update_live_presentations_updated_at
  BEFORE UPDATE ON live_presentations
  FOR EACH ROW
  EXECUTE FUNCTION update_presentation_updated_at();

-- Views for Easy Querying

-- Active Presentations View
CREATE OR REPLACE VIEW active_presentations AS
SELECT 
  ps.id,
  ps.agent_email,
  ps.agent_name,
  ps.associate_id,
  ps.presentation_type,
  ps.client_name,
  ps.started_at,
  EXTRACT(EPOCH FROM (NOW() - ps.started_at))::INTEGER as duration_seconds,
  lp.current_slide_number,
  lp.current_slide_title,
  lp.viewer_count,
  lp.current_screenshot_url
FROM presentation_sessions ps
JOIN live_presentations lp ON ps.id = lp.session_id
WHERE ps.status = 'active' AND lp.is_active = true;

-- Presentation Summary View (for reporting)
CREATE OR REPLACE VIEW presentation_summary AS
SELECT 
  ps.id,
  ps.agent_email,
  ps.agent_name,
  ps.associate_id,
  ps.client_name,
  ps.started_at,
  ps.ended_at,
  ps.duration_seconds,
  ps.total_slides_shown,
  ps.engagement_score,
  pk.presentation_completed,
  pk.completion_percentage,
  pk.products_covered,
  pk.sale_made,
  COUNT(pss.id) as screenshot_count
FROM presentation_sessions ps
LEFT JOIN presentation_kpis pk ON ps.id = pk.session_id
LEFT JOIN presentation_screenshots pss ON ps.id = pss.session_id
GROUP BY ps.id, pk.id;

