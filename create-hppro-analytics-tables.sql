-- HPPRO Presentation Analytics Tables
-- Based on actual HPPRO screenshot analysis
-- These tables store detailed milestone data, while presentation_sessions stores aggregated data

-- 1. Presentation Milestones (every phase change gets logged)
CREATE TABLE IF NOT EXISTS hppro_presentation_milestones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id VARCHAR(255) NOT NULL,
  
  -- Milestone Details
  milestone VARCHAR(50) NOT NULL, -- 'lead_selection', 'client_info', 'quotes', 'comparison', 'application', 'summary'
  milestone_name VARCHAR(255),
  confidence DECIMAL(3,2), -- AI confidence 0-1
  
  -- Timing
  reached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  time_in_phase_seconds INTEGER, -- How long they stayed in this phase
  
  -- Screenshot reference
  screenshot_id VARCHAR(255),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Lead Selection Events (when agent searches/selects leads)
CREATE TABLE IF NOT EXISTS hppro_lead_selection (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id VARCHAR(255) NOT NULL,
  
  -- Search/Filter Details
  lead_type VARCHAR(100), -- 'Medicare', 'Life Insurance', 'ACA', 'Annuity'
  lead_source VARCHAR(255),
  search_filters JSONB, -- All applied filters
  results_count INTEGER,
  
  -- Lead Selected
  lead_id VARCHAR(255),
  lead_name VARCHAR(500),
  
  -- Timing
  occurred_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  screenshot_id VARCHAR(255),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Client Information Captured (from client detail screen)
CREATE TABLE IF NOT EXISTS hppro_client_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id VARCHAR(255) NOT NULL,
  
  -- Personal Information
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  full_name VARCHAR(500),
  phone VARCHAR(50),
  email VARCHAR(255),
  
  -- Address
  street_address VARCHAR(500),
  city VARCHAR(255),
  state VARCHAR(50),
  zip VARCHAR(20),
  county VARCHAR(255),
  
  -- Demographics
  date_of_birth DATE,
  age INTEGER,
  gender VARCHAR(20),
  marital_status VARCHAR(50),
  
  -- Health/Lifestyle
  tobacco_user BOOLEAN,
  height VARCHAR(20),
  weight INTEGER,
  health_conditions TEXT[],
  medications TEXT[],
  
  -- Lead Info
  lead_type VARCHAR(100),
  lead_status VARCHAR(50),
  lead_priority VARCHAR(20), -- 'hot', 'warm', 'cold'
  lead_score INTEGER,
  last_contact_date DATE,
  
  -- Timing
  captured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  screenshot_id VARCHAR(255),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Price Quotes Generated (every quote shown)
CREATE TABLE IF NOT EXISTS hppro_price_quotes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id VARCHAR(255) NOT NULL,
  
  -- Quote Details
  carrier VARCHAR(255) NOT NULL,
  product_name VARCHAR(500) NOT NULL,
  product_type VARCHAR(100), -- 'Term Life', 'Whole Life', 'Universal Life', 'Medicare Advantage', 'Medicare Supplement', 'ACA', 'Annuity'
  
  -- Coverage Details
  coverage_amount DECIMAL(12,2),
  coverage_term INTEGER, -- Term length in years
  coverage_type VARCHAR(100), -- 'Individual', 'Family', 'Spouse', etc.
  
  -- Pricing
  monthly_premium DECIMAL(10,2),
  annual_premium DECIMAL(10,2),
  first_year_premium DECIMAL(10,2),
  
  -- Commission/Payout
  agent_commission DECIMAL(10,2),
  commission_percentage DECIMAL(5,2),
  
  -- Quote Metadata
  quote_number VARCHAR(255),
  quote_valid_until DATE,
  underwriting_class VARCHAR(50), -- 'Preferred', 'Standard', 'Substandard'
  
  -- Additional Features
  riders TEXT[], -- Array of rider names
  benefits TEXT[], -- Array of benefit descriptions
  exclusions TEXT[],
  
  -- Selection Status
  was_selected BOOLEAN DEFAULT false,
  was_discussed BOOLEAN DEFAULT false,
  time_displayed_seconds INTEGER,
  
  -- Timing
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  screenshot_id VARCHAR(255),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Products Discussed/Compared
CREATE TABLE IF NOT EXISTS hppro_products_discussed (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id VARCHAR(255) NOT NULL,
  
  -- Product Details
  product_type VARCHAR(100) NOT NULL,
  carrier VARCHAR(255),
  product_name VARCHAR(500),
  
  -- Features Highlighted
  key_features TEXT[],
  benefits TEXT[],
  riders_discussed TEXT[],
  
  -- Comparison Data
  compared_with TEXT[], -- Array of other products
  comparison_points TEXT[], -- What was compared
  
  -- Agent Notes
  presentation_notes TEXT,
  client_interest_level VARCHAR(20), -- 'high', 'medium', 'low'
  
  -- Timing
  discussed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  time_spent_seconds INTEGER,
  screenshot_id VARCHAR(255),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Application/Enrollment Progress
CREATE TABLE IF NOT EXISTS hppro_enrollment_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id VARCHAR(255) NOT NULL,
  
  -- Application Status
  application_id VARCHAR(255),
  application_started BOOLEAN DEFAULT false,
  application_completed BOOLEAN DEFAULT false,
  
  -- Progress Tracking (which sections done)
  personal_info_completed BOOLEAN DEFAULT false,
  health_questions_completed BOOLEAN DEFAULT false,
  medical_history_completed BOOLEAN DEFAULT false,
  beneficiary_added BOOLEAN DEFAULT false,
  payment_method_added BOOLEAN DEFAULT false,
  bank_info_verified BOOLEAN DEFAULT false,
  esignature_completed BOOLEAN DEFAULT false,
  voice_signature_completed BOOLEAN DEFAULT false,
  
  -- Application Details
  policy_number VARCHAR(255),
  carrier VARCHAR(255),
  product_name VARCHAR(500),
  coverage_amount DECIMAL(12,2),
  monthly_premium DECIMAL(10,2),
  
  -- Payment Information
  payment_method VARCHAR(50), -- 'Bank Draft', 'Credit Card', 'Check'
  payment_frequency VARCHAR(20), -- 'Monthly', 'Quarterly', 'Annual'
  first_payment_date DATE,
  
  -- Underwriting
  underwriting_status VARCHAR(50), -- 'pending', 'approved', 'declined', 'conditional'
  medical_exam_required BOOLEAN,
  additional_docs_required TEXT[],
  
  -- Completion Details
  submitted_at TIMESTAMP WITH TIME ZONE,
  approved_at TIMESTAMP WITH TIME ZONE,
  policy_issued_at TIMESTAMP WITH TIME ZONE,
  
  -- Timing
  started_at TIMESTAMP WITH TIME ZONE,
  last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  screenshot_id VARCHAR(255),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Analytics Summary (final dashboard data)
CREATE TABLE IF NOT EXISTS hppro_analytics_summary (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id VARCHAR(255) NOT NULL UNIQUE,
  
  -- Session Metrics
  total_duration_minutes INTEGER,
  active_time_minutes INTEGER,
  idle_time_minutes INTEGER,
  
  -- Activity Counts
  leads_reviewed INTEGER DEFAULT 0,
  leads_contacted INTEGER DEFAULT 0,
  total_quotes_generated INTEGER DEFAULT 0,
  quotes_presented_to_client INTEGER DEFAULT 0,
  products_compared INTEGER DEFAULT 0,
  applications_started INTEGER DEFAULT 0,
  applications_completed INTEGER DEFAULT 0,
  
  -- Sales Results
  sale_made BOOLEAN DEFAULT false,
  number_of_sales INTEGER DEFAULT 0,
  total_premium_sold DECIMAL(12,2),
  total_coverage_sold DECIMAL(12,2),
  total_commission_earned DECIMAL(10,2),
  
  -- Products/Carriers
  products_presented TEXT[],
  products_sold TEXT[],
  carriers_shown TEXT[],
  carriers_sold TEXT[],
  
  -- Client Outcome
  client_interest_level VARCHAR(20), -- 'high', 'medium', 'low', 'none'
  client_objections TEXT[],
  follow_up_scheduled BOOLEAN DEFAULT false,
  follow_up_date DATE,
  follow_up_type VARCHAR(50), -- 'call', 'email', 'meeting'
  
  -- Next Steps
  next_action VARCHAR(255),
  next_action_date DATE,
  agent_notes TEXT,
  
  -- Performance Metrics
  presentation_quality_score DECIMAL(3,2), -- 0-1 AI score
  engagement_score DECIMAL(3,2), -- 0-1 AI score
  conversion_likelihood DECIMAL(3,2), -- 0-1 AI prediction
  
  -- Timing
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  screenshot_id VARCHAR(255),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for Performance
-- Note: Run these AFTER verifying tables are created successfully

-- CREATE INDEX IF NOT EXISTS idx_hppro_milestones_session ON hppro_presentation_milestones(session_id);
-- CREATE INDEX IF NOT EXISTS idx_hppro_milestones_milestone ON hppro_presentation_milestones(milestone);
-- CREATE INDEX IF NOT EXISTS idx_hppro_milestones_time ON hppro_presentation_milestones(reached_at DESC);

-- CREATE INDEX IF NOT EXISTS idx_hppro_lead_selection_session ON hppro_lead_selection(session_id);
-- CREATE INDEX IF NOT EXISTS idx_hppro_lead_selection_type ON hppro_lead_selection(lead_type);

-- CREATE INDEX IF NOT EXISTS idx_hppro_client_data_session ON hppro_client_data(session_id);
-- CREATE INDEX IF NOT EXISTS idx_hppro_client_data_name ON hppro_client_data(last_name, first_name);
-- CREATE INDEX IF NOT EXISTS idx_hppro_client_data_phone ON hppro_client_data(phone);

-- CREATE INDEX IF NOT EXISTS idx_hppro_quotes_session ON hppro_price_quotes(session_id);
-- CREATE INDEX IF NOT EXISTS idx_hppro_quotes_carrier ON hppro_price_quotes(carrier);
-- CREATE INDEX IF NOT EXISTS idx_hppro_quotes_product_type ON hppro_price_quotes(product_type);
-- CREATE INDEX IF NOT EXISTS idx_hppro_quotes_selected ON hppro_price_quotes(was_selected);

-- CREATE INDEX IF NOT EXISTS idx_hppro_products_session ON hppro_products_discussed(session_id);
-- CREATE INDEX IF NOT EXISTS idx_hppro_products_type ON hppro_products_discussed(product_type);

-- CREATE INDEX IF NOT EXISTS idx_hppro_enrollment_session ON hppro_enrollment_data(session_id);
-- CREATE INDEX IF NOT EXISTS idx_hppro_enrollment_status ON hppro_enrollment_data(application_completed);

-- CREATE INDEX IF NOT EXISTS idx_hppro_analytics_session ON hppro_analytics_summary(session_id);
-- CREATE INDEX IF NOT EXISTS idx_hppro_analytics_sale ON hppro_analytics_summary(sale_made);

