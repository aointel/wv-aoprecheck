-- COMPREHENSIVE HPPRO DATA POINTS
-- Based on actual screenshot analysis of HPPRO presentation screens

-- GROUP CODE (Introduction Benefits screen)
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS group_code VARCHAR(50);

-- SPONSORSHIP PROGRAM DATA
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS sponsor_first_name VARCHAR(100);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS sponsor_last_name VARCHAR(100);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS sponsor_organization VARCHAR(200);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS sponsor_phone VARCHAR(50);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS sponsor_email VARCHAR(200);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS sponsorship_date DATE;
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS total_gifted DECIMAL(10,2);

-- SPONSORED BENEFIT DETAILS
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS benefit_type VARCHAR(50);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS branch_of_service VARCHAR(50);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS sponsored_first_name VARCHAR(100);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS sponsored_last_name VARCHAR(100);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS sponsored_city VARCHAR(100);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS sponsored_state VARCHAR(50);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS sponsored_phone VARCHAR(50);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS relationship_to_sponsor VARCHAR(100);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS occupation VARCHAR(100);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS significant_other VARCHAR(100);

-- PRIMARY CLIENT INFO (Needs Analysis)
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS primary_first_name VARCHAR(100);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS primary_last_name VARCHAR(100);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS primary_dob DATE;
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS primary_age INTEGER;
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS primary_status VARCHAR(50);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS primary_gender VARCHAR(20);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS primary_email VARCHAR(200);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS primary_phone VARCHAR(50);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS primary_zip VARCHAR(20);

-- SPOUSE INFO
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS spouse_first_name VARCHAR(100);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS spouse_last_name VARCHAR(100);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS spouse_dob DATE;
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS spouse_occupation VARCHAR(100);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS spouse_gender VARCHAR(20);

-- FAMILY INFO
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS has_dependent_children BOOLEAN;

-- LIFE INSURANCE THROUGH WORK (Primary)
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS primary_work_whole_life DECIMAL(10,2);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS primary_work_term_life DECIMAL(10,2);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS primary_work_accidental DECIMAL(10,2);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS primary_work_group DECIMAL(10,2);

-- LIFE INSURANCE THROUGH WORK (Spouse)
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS spouse_work_whole_life DECIMAL(10,2);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS spouse_work_term_life DECIMAL(10,2);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS spouse_work_accidental DECIMAL(10,2);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS spouse_work_group DECIMAL(10,2);

-- LIFE INSURANCE OUTSIDE WORK (Primary)
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS primary_outside_whole_life DECIMAL(10,2);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS primary_outside_term_life DECIMAL(10,2);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS primary_outside_accidental DECIMAL(10,2);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS primary_outside_group DECIMAL(10,2);

-- LIFE INSURANCE OUTSIDE WORK (Spouse)
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS spouse_outside_whole_life DECIMAL(10,2);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS spouse_outside_term_life DECIMAL(10,2);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS spouse_outside_accidental DECIMAL(10,2);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS spouse_outside_group DECIMAL(10,2);

-- HOMEOWNERSHIP
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS home_status VARCHAR(20);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS monthly_payment DECIMAL(10,2);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS mortgage_balance DECIMAL(10,2);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS mortgage_interest_rate DECIMAL(5,2);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS mortgage_years_remaining INTEGER;

-- HOME INSURANCE
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS has_death_insurance BOOLEAN;
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS death_insurance_amount DECIMAL(10,2);

-- COLLEGE EDUCATION
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS has_college_provision BOOLEAN;
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS college_provision_amount DECIMAL(10,2);

-- HOUSEHOLD TYPE
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS household_type VARCHAR(50);

-- BANKING
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS banks_locally_checking BOOLEAN;
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS banks_locally_savings BOOLEAN;

-- PLAN GENERATOR DATA
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS primary_hourly_wage DECIMAL(10,2);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS primary_terminated_unemployed BOOLEAN;
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS primary_has_children_under_18 BOOLEAN;
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS spouse_hourly_wage DECIMAL(10,2);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS spouse_terminated_unemployed BOOLEAN;
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS spouse_has_children_under_18 BOOLEAN;

-- ALLOCATION OPTIONS
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS allocation_hour_power BOOLEAN;
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS allocation_monthly BOOLEAN;
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS allocation_dollar_a_day BOOLEAN;
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS allocation_need BOOLEAN;
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS primary_contribution DECIMAL(10,2);

-- ALLOCATION SUMMARY
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS remaining_daily DECIMAL(10,2);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS remaining_monthly DECIMAL(10,2);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS used_daily DECIMAL(10,2);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS used_monthly DECIMAL(10,2);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS wage_daily DECIMAL(10,2);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS wage_monthly DECIMAL(10,2);

-- PLAN LEVELS
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS enhanced_monthly DECIMAL(10,2);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS recommended_monthly DECIMAL(10,2);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS basic_monthly DECIMAL(10,2);

-- PRODUCTS PRESENTED (Primary - A71000)
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS product_a71000_added BOOLEAN;
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS product_a71000_coverage DECIMAL(10,2);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS product_a71000_option VARCHAR(100);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS product_a71000_present_as VARCHAR(100);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS product_a71000_daily_cost DECIMAL(10,2);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS product_a71000_mbd DECIMAL(10,2);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS product_a71000_ahp DECIMAL(10,2);

-- PRODUCTS PRESENTED (Primary - SRGWL)
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS product_srgwl_added BOOLEAN;
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS product_srgwl_coverage DECIMAL(10,2);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS product_srgwl_option VARCHAR(100);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS product_srgwl_present_as VARCHAR(100);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS product_srgwl_daily_cost DECIMAL(10,2);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS product_srgwl_mbd DECIMAL(10,2);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS product_srgwl_alp DECIMAL(10,2);

-- PRODUCTS PRESENTED (Primary - 10YRC Monthly Income)
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS product_10yrc_monthly_added BOOLEAN;
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS product_10yrc_monthly_coverage DECIMAL(10,2);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS product_10yrc_monthly_daily_cost DECIMAL(10,2);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS product_10yrc_monthly_mbd DECIMAL(10,2);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS product_10yrc_monthly_alp DECIMAL(10,2);

-- PRODUCTS PRESENTED (Primary - 10YRC House Payment)
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS product_10yrc_house_added BOOLEAN;
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS product_10yrc_house_coverage DECIMAL(10,2);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS product_10yrc_house_daily_cost DECIMAL(10,2);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS product_10yrc_house_mbd DECIMAL(10,2);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS product_10yrc_house_alp DECIMAL(10,2);

-- PRODUCTS PRESENTED (Primary - ADB)
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS product_adb_primary_added BOOLEAN;
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS product_adb_primary_coverage DECIMAL(10,2);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS product_adb_primary_daily_cost DECIMAL(10,2);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS product_adb_primary_mbd DECIMAL(10,2);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS product_adb_primary_alp DECIMAL(10,2);

-- PRODUCTS PRESENTED (Spouse - WHL)
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS product_whl_spouse_added BOOLEAN;
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS product_whl_spouse_coverage DECIMAL(10,2);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS product_whl_spouse_daily_cost DECIMAL(10,2);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS product_whl_spouse_mbd DECIMAL(10,2);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS product_whl_spouse_alp DECIMAL(10,2);

-- PRODUCTS PRESENTED (Spouse - 10YRC)
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS product_10yrc_spouse_added BOOLEAN;
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS product_10yrc_spouse_coverage DECIMAL(10,2);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS product_10yrc_spouse_daily_cost DECIMAL(10,2);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS product_10yrc_spouse_mbd DECIMAL(10,2);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS product_10yrc_spouse_alp DECIMAL(10,2);

-- PRODUCTS PRESENTED (Spouse - ADB)
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS product_adb_spouse_added BOOLEAN;
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS product_adb_spouse_coverage DECIMAL(10,2);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS product_adb_spouse_daily_cost DECIMAL(10,2);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS product_adb_spouse_mbd DECIMAL(10,2);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS product_adb_spouse_alp DECIMAL(10,2);

-- BENEFITS SUMMARY
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS selected_plan VARCHAR(50);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS summary_daily DECIMAL(10,2);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS summary_mbd DECIMAL(10,2);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS when_something_happens DECIMAL(10,2);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS beneficiary_name VARCHAR(200);

-- HOSPITAL BENEFITS
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS emergency_room_benefit DECIMAL(10,2);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS daily_hospital_benefit DECIMAL(10,2);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS intensive_care_benefit DECIMAL(10,2);

-- FREEDOM OF CHOICE BENEFITS
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS any_cause_of_death DECIMAL(10,2);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS accident_death DECIMAL(10,2);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS auto_accident_death DECIMAL(10,2);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS common_carrier_death DECIMAL(10,2);

-- FINISH PRESENTATION DATA
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS presentation_outcome VARCHAR(50);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS field_training_status VARCHAR(50);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS vso_enrollment BOOLEAN;
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS presentation_notes TEXT;

-- PRESENTATION METADATA
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS market_type VARCHAR(50);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS presentation_date TIMESTAMP;
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS sub_type VARCHAR(50);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS total_presentation_time VARCHAR(20);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS premium_approach VARCHAR(100);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS combined_daily_premium DECIMAL(10,2);

-- PLAN SELECTED DETAILS
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS selected_plan_alp DECIMAL(10,2);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS selected_plan_ahp DECIMAL(10,2);

-- SECTION DURATIONS
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS no_cost_benefits_duration VARCHAR(20);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS needs_analysis_duration VARCHAR(20);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS plan_generator_duration VARCHAR(20);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS present_plan_duration VARCHAR(20);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS benefit_summary_duration VARCHAR(20);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS eapp_duration VARCHAR(20);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS report_card_duration VARCHAR(20);

-- AGENT INFO
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS agent_name VARCHAR(200);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS agent_license VARCHAR(100);
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS agent_opeiu VARCHAR(50);

-- Create indexes for commonly queried fields
CREATE INDEX IF NOT EXISTS idx_presentation_group_code ON presentation_sessions(group_code);
CREATE INDEX IF NOT EXISTS idx_presentation_sponsor ON presentation_sessions(sponsor_first_name, sponsor_last_name);
CREATE INDEX IF NOT EXISTS idx_presentation_primary_client ON presentation_sessions(primary_first_name, primary_last_name);
CREATE INDEX IF NOT EXISTS idx_presentation_outcome ON presentation_sessions(presentation_outcome);
CREATE INDEX IF NOT EXISTS idx_presentation_selected_plan ON presentation_sessions(selected_plan);
CREATE INDEX IF NOT EXISTS idx_presentation_market_type ON presentation_sessions(market_type);
