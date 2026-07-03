-- Create table for completed HPPRO presentations with all extracted data
CREATE TABLE IF NOT EXISTS hppro_presentation_complete (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES presentation_sessions(id) ON DELETE CASCADE,
  
  -- Agent Info
  agent_email VARCHAR(255) NOT NULL,
  agent_name VARCHAR(255),
  agent_license VARCHAR(100),
  agent_opeiu VARCHAR(100),
  associate_id INTEGER,
  
  -- Presentation Metadata
  presentation_url TEXT,
  presentation_date TIMESTAMP WITH TIME ZONE,
  total_presentation_time VARCHAR(50),
  market_type VARCHAR(50),
  sub_type VARCHAR(100),
  presentation_outcome VARCHAR(50),
  field_training_status VARCHAR(50),
  vso_enrollment BOOLEAN,
  presentation_notes TEXT,
  
  -- Group Code & Materials
  group_code VARCHAR(50),
  
  -- Sponsorship Program
  sponsor_first_name VARCHAR(255),
  sponsor_last_name VARCHAR(255),
  sponsor_organization VARCHAR(255),
  sponsor_phone VARCHAR(50),
  sponsor_email VARCHAR(255),
  sponsorship_date DATE,
  total_gifted DECIMAL(10,2),
  benefit_type VARCHAR(100),
  branch_of_service VARCHAR(100),
  sponsored_first_name VARCHAR(255),
  sponsored_last_name VARCHAR(255),
  sponsored_city VARCHAR(255),
  sponsored_state VARCHAR(10),
  sponsored_phone VARCHAR(50),
  relationship_to_sponsor VARCHAR(100),
  occupation VARCHAR(255),
  significant_other VARCHAR(255),
  
  -- Primary Client
  primary_first_name VARCHAR(255),
  primary_last_name VARCHAR(255),
  primary_dob DATE,
  primary_age INTEGER,
  primary_status VARCHAR(50),
  primary_gender VARCHAR(20),
  primary_email VARCHAR(255),
  primary_phone VARCHAR(50),
  primary_zip VARCHAR(20),
  
  -- Spouse Info
  spouse_first_name VARCHAR(255),
  spouse_last_name VARCHAR(255),
  spouse_dob DATE,
  spouse_occupation VARCHAR(255),
  spouse_gender VARCHAR(20),
  
  -- Family
  has_dependent_children BOOLEAN,
  
  -- Life Insurance Through Work (Primary)
  primary_work_whole_life DECIMAL(10,2),
  primary_work_term_life DECIMAL(10,2),
  primary_work_accidental DECIMAL(10,2),
  primary_work_group DECIMAL(10,2),
  
  -- Life Insurance Through Work (Spouse)
  spouse_work_whole_life DECIMAL(10,2),
  spouse_work_term_life DECIMAL(10,2),
  spouse_work_accidental DECIMAL(10,2),
  spouse_work_group DECIMAL(10,2),
  
  -- Life Insurance Outside Work (Primary)
  primary_outside_whole_life DECIMAL(10,2),
  primary_outside_term_life DECIMAL(10,2),
  primary_outside_accidental DECIMAL(10,2),
  primary_outside_group DECIMAL(10,2),
  
  -- Life Insurance Outside Work (Spouse)
  spouse_outside_whole_life DECIMAL(10,2),
  spouse_outside_term_life DECIMAL(10,2),
  spouse_outside_accidental DECIMAL(10,2),
  spouse_outside_group DECIMAL(10,2),
  
  -- Homeownership
  home_status VARCHAR(20),
  monthly_payment DECIMAL(10,2),
  mortgage_balance DECIMAL(12,2),
  mortgage_interest_rate DECIMAL(5,2),
  mortgage_years_remaining INTEGER,
  has_death_insurance BOOLEAN,
  death_insurance_amount DECIMAL(10,2),
  has_college_provision BOOLEAN,
  college_provision_amount DECIMAL(10,2),
  
  -- Household
  household_type VARCHAR(50),
  banks_locally_checking BOOLEAN,
  banks_locally_savings BOOLEAN,
  
  -- Plan Generator
  primary_hourly_wage DECIMAL(10,2),
  primary_terminated_unemployed BOOLEAN,
  primary_has_children_under_18 BOOLEAN,
  spouse_hourly_wage DECIMAL(10,2),
  spouse_terminated_unemployed BOOLEAN,
  spouse_has_children_under_18 BOOLEAN,
  allocation_hour_power DECIMAL(10,2),
  allocation_monthly DECIMAL(10,2),
  allocation_dollar_a_day DECIMAL(10,2),
  allocation_need DECIMAL(10,2),
  primary_contribution DECIMAL(10,2),
  remaining_daily DECIMAL(10,2),
  remaining_monthly DECIMAL(10,2),
  used_daily DECIMAL(10,2),
  used_monthly DECIMAL(10,2),
  wage_daily DECIMAL(10,2),
  wage_monthly DECIMAL(10,2),
  
  -- Plan Levels
  enhanced_monthly DECIMAL(10,2),
  recommended_monthly DECIMAL(10,2),
  basic_monthly DECIMAL(10,2),
  
  -- Products (store as JSONB for flexibility)
  products JSONB,
  
  -- Benefits Summary
  selected_plan VARCHAR(50),
  summary_daily DECIMAL(10,2),
  summary_mbd DECIMAL(10,2),
  when_something_happens DECIMAL(10,2),
  beneficiary_name VARCHAR(255),
  emergency_room_benefit DECIMAL(10,2),
  daily_hospital_benefit DECIMAL(10,2),
  intensive_care_benefit DECIMAL(10,2),
  any_cause_of_death DECIMAL(12,2),
  accident_death DECIMAL(12,2),
  auto_accident_death DECIMAL(12,2),
  common_carrier_death DECIMAL(12,2),
  
  -- Finish Presentation
  premium_approach VARCHAR(100),
  combined_daily_premium DECIMAL(10,2),
  selected_plan_alp DECIMAL(10,2),
  selected_plan_ahp DECIMAL(10,2),
  
  -- Duration Tracking
  no_cost_benefits_duration VARCHAR(50),
  needs_analysis_duration VARCHAR(50),
  plan_generator_duration VARCHAR(50),
  present_plan_duration VARCHAR(50),
  benefit_summary_duration VARCHAR(50),
  eapp_duration VARCHAR(50),
  report_card_duration VARCHAR(50),
  
  -- AI Analysis
  ai_summary TEXT,
  key_topics TEXT[],
  engagement_score DECIMAL(3,2),
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_hppro_complete_session ON hppro_presentation_complete(session_id);
CREATE INDEX IF NOT EXISTS idx_hppro_complete_agent ON hppro_presentation_complete(agent_email);
CREATE INDEX IF NOT EXISTS idx_hppro_complete_date ON hppro_presentation_complete(presentation_date);
CREATE INDEX IF NOT EXISTS idx_hppro_complete_outcome ON hppro_presentation_complete(presentation_outcome);
CREATE INDEX IF NOT EXISTS idx_hppro_complete_created ON hppro_presentation_complete(created_at);

