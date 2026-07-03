-- Add ALL HPPRO data fields as actual columns to presentation_sessions table
-- This gives us proper indexing, querying, and persistence

ALTER TABLE presentation_sessions 
-- Session tracking
ADD COLUMN IF NOT EXISTS session_id VARCHAR(255) UNIQUE,

-- Current phase tracking
ADD COLUMN IF NOT EXISTS current_phase VARCHAR(50), -- 'lead_selection', 'client_info', 'quotes', 'comparison', 'application', 'summary'
ADD COLUMN IF NOT EXISTS phase_updated_at TIMESTAMP WITH TIME ZONE,

-- Client Information (extracted from HPPRO client info screen)
ADD COLUMN IF NOT EXISTS client_first_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS client_last_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS client_full_name VARCHAR(500),
ADD COLUMN IF NOT EXISTS client_phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS client_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS client_address VARCHAR(500),
ADD COLUMN IF NOT EXISTS client_city VARCHAR(255),
ADD COLUMN IF NOT EXISTS client_state VARCHAR(50),
ADD COLUMN IF NOT EXISTS client_zip VARCHAR(20),
ADD COLUMN IF NOT EXISTS client_age INTEGER,
ADD COLUMN IF NOT EXISTS client_dob DATE,
ADD COLUMN IF NOT EXISTS client_gender VARCHAR(20),
ADD COLUMN IF NOT EXISTS client_tobacco_user BOOLEAN,
ADD COLUMN IF NOT EXISTS lead_type VARCHAR(100), -- 'Medicare', 'Life Insurance', 'ACA', 'Annuity', etc.
ADD COLUMN IF NOT EXISTS lead_source VARCHAR(255),
ADD COLUMN IF NOT EXISTS lead_status VARCHAR(50),

-- Quote/Pricing Information (from HPPRO quotes screen)
ADD COLUMN IF NOT EXISTS total_quotes_generated INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS quotes_shown TEXT[], -- Array of quote IDs or carrier-product combos
ADD COLUMN IF NOT EXISTS carriers_quoted TEXT[], -- Array of carrier names
ADD COLUMN IF NOT EXISTS products_quoted TEXT[], -- Array of product names
ADD COLUMN IF NOT EXISTS lowest_monthly_premium DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS highest_monthly_premium DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS average_premium DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS selected_quote_carrier VARCHAR(255),
ADD COLUMN IF NOT EXISTS selected_quote_product VARCHAR(255),
ADD COLUMN IF NOT EXISTS selected_coverage_amount DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS selected_monthly_premium DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS selected_annual_premium DECIMAL(10,2),

-- Product Comparison (from HPPRO comparison screen)
ADD COLUMN IF NOT EXISTS products_compared TEXT[], -- Array of products shown side-by-side
ADD COLUMN IF NOT EXISTS comparison_duration_seconds INTEGER, -- Time spent on comparison screen

-- Application/Enrollment Status (from HPPRO application screens)
ADD COLUMN IF NOT EXISTS application_started BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS application_started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS personal_info_completed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS health_questions_completed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS beneficiary_added BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS payment_method_added BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS esignature_completed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS application_submitted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS application_submitted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS policy_number VARCHAR(255),
ADD COLUMN IF NOT EXISTS application_status VARCHAR(50), -- 'pending', 'approved', 'declined', 'incomplete'

-- Session Analytics/Summary (from HPPRO final summary screen)
ADD COLUMN IF NOT EXISTS total_leads_reviewed INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS sale_made BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS sale_amount DECIMAL(12,2), -- Premium sold
ADD COLUMN IF NOT EXISTS products_sold TEXT[], -- Array of products sold
ADD COLUMN IF NOT EXISTS carriers_sold TEXT[], -- Array of carriers
ADD COLUMN IF NOT EXISTS agent_commission DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS next_action_scheduled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS follow_up_date DATE,
ADD COLUMN IF NOT EXISTS follow_up_notes TEXT,

-- Time Tracking (by phase)
ADD COLUMN IF NOT EXISTS time_in_lead_selection INTEGER DEFAULT 0, -- seconds
ADD COLUMN IF NOT EXISTS time_in_client_info INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS time_in_quotes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS time_in_comparison INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS time_in_application INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS time_in_summary INTEGER DEFAULT 0,

-- Screenshot count (for quick reference)
ADD COLUMN IF NOT EXISTS screenshot_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_screenshot_at TIMESTAMP WITH TIME ZONE;

-- Populate session_id for existing rows
UPDATE presentation_sessions 
SET session_id = id::text 
WHERE session_id IS NULL OR session_id = '';

-- Create indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_presentation_sessions_session_id ON presentation_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_presentation_sessions_phase ON presentation_sessions(current_phase);
CREATE INDEX IF NOT EXISTS idx_presentation_sessions_client_name ON presentation_sessions(client_last_name, client_first_name);
CREATE INDEX IF NOT EXISTS idx_presentation_sessions_client_phone ON presentation_sessions(client_phone);
CREATE INDEX IF NOT EXISTS idx_presentation_sessions_lead_type ON presentation_sessions(lead_type);
CREATE INDEX IF NOT EXISTS idx_presentation_sessions_sale_made ON presentation_sessions(sale_made);
CREATE INDEX IF NOT EXISTS idx_presentation_sessions_application_status ON presentation_sessions(application_status);
CREATE INDEX IF NOT EXISTS idx_presentation_sessions_agent_date ON presentation_sessions(agent_email, started_at DESC);

-- Add comments for documentation
COMMENT ON COLUMN presentation_sessions.current_phase IS 'Current HPPRO phase: lead_selection, client_info, quotes, comparison, application, summary';
COMMENT ON COLUMN presentation_sessions.lead_type IS 'Type of insurance lead: Medicare, Life Insurance, ACA, Annuity, etc.';
COMMENT ON COLUMN presentation_sessions.sale_made IS 'Whether presentation resulted in a sale';
COMMENT ON COLUMN presentation_sessions.application_started IS 'Whether application process was initiated';
COMMENT ON COLUMN presentation_sessions.screenshot_count IS 'Total number of screenshots captured for this session';

