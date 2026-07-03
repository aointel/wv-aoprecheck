# HPPRO Presentation Tracking - Based on Actual Screenshots

## Phases Detected in HPPRO

### Phase 1: Lead Selection
- **Screen:** Lead search/filter interface
- **Data to Extract:**
  - Lead source
  - Search filters applied
  - Number of leads shown

### Phase 2: Client Information
- **Screen:** Lead detail page showing client demographics
- **Data to Extract:**
  - First Name
  - Last Name  
  - Phone Number
  - Email
  - Full Address (Street, City, State, ZIP)
  - Date of Birth / Age
  - Gender
  - Tobacco User status
  - Lead Type (Medicare, Life Insurance, ACA, etc.)
  - Lead Status
  - Last Contact Date

### Phase 3: Quote Generation
- **Screen:** Insurance quotes table from multiple carriers
- **Data to Extract:**
  - Number of quotes generated
  - For each quote:
    - Carrier name
    - Product name
    - Product type (Term, Whole Life, Universal Life, etc.)
    - Coverage amount
    - Monthly premium
    - Annual premium
    - Quote date
    - Agent commission (if visible)

### Phase 4: Product Comparison
- **Screen:** Side-by-side product comparison
- **Data to Extract:**
  - Products being compared
  - Key features highlighted
  - Riders discussed
  - Underwriting requirements

### Phase 5: Application/Enrollment
- **Screen:** Application form wizard
- **Data to Extract:**
  - Application started (yes/no)
  - Personal information completed
  - Health questions answered
  - Beneficiary added
  - Payment method entered
  - E-signature completed
  - Application submitted
  - Policy number (if issued)

### Phase 6: Session Summary/Analytics
- **Screen:** Final analytics dashboard
- **Data to Extract:**
  - Total session duration
  - Total leads reviewed
  - Total quotes generated
  - Total applications started
  - Total applications completed
  - Sale made (yes/no)
  - Total premium sold
  - Products sold (list)
  - Carriers used (list)
  - Next action scheduled

## Updated Database Schema

```sql
-- Main session tracking
ALTER TABLE presentation_sessions 
ADD COLUMN IF NOT EXISTS current_phase VARCHAR(50), -- 'lead_selection', 'client_info', 'quotes', 'comparison', 'application', 'summary'
ADD COLUMN IF NOT EXISTS client_data JSONB, -- All extracted client info
ADD COLUMN IF NOT EXISTS session_id VARCHAR(255) UNIQUE;

-- Phase-specific tables (already exist in create-hppro-analytics-tables.sql)
-- ✓ hppro_presentation_milestones
-- ✓ hppro_lead_selection  
-- ✓ hppro_price_quotes
-- ✓ hppro_products_discussed
-- ✓ hppro_enrollment_data
-- ✓ hppro_analytics_summary
```

## AI Analysis Prompt (Updated)

The ChatGPT Vision prompt should identify these 6 phases and extract:

1. **Lead Selection:** Lead type, filters
2. **Client Info:** Name, phone, address, DOB, tobacco status, lead type
3. **Quotes:** All visible quotes with carrier, product, premiums
4. **Comparison:** Products being compared
5. **Application:** Form completion status, sections done
6. **Summary:** All KPIs from final dashboard

## Frontend Display

### Agent View ("My Presentations"):
- Show current phase with progress bar (6 stages)
- Show extracted client name, phone, city
- Show "Start Verification" button when client data available

### Manager View ("Presentation Analytics"):
- Progress column showing which phase (1-6)
- Client data column
- Quote count
- Application status
- Final KPIs

## Key Metrics to Track

1. **Time in Each Phase** - How long on each screen
2. **Quote Count** - How many quotes generated
3. **Quote Conversion** - Which quotes led to applications
4. **Application Completion Rate** - Started vs completed
5. **Sale Rate** - Applications that resulted in sales
6. **Average Premium** - When sales are made
7. **Products Most Discussed** - Which products shown most
8. **Carriers Most Used** - Which carriers quoted most

