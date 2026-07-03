/**
 * HPPRO Presentation Analyzer
 * Uses ChatGPT Vision to analyze screenshots and extract presentation data
 */

import OpenAI from 'openai';
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY, OPENAI_API_KEY } from './hardcoded-config';

// ENABLED: HPPRO analyzer uses OpenAI for screenshot analysis
const openAIClient = OPENAI_API_KEY ? new OpenAI({ 
  apiKey: OPENAI_API_KEY
}) : null;
import { supabaseAdmin } from './supabase';

interface HPProScreenAnalysis {
  milestone: 'intro' | 'sponsorship' | 'needs_analysis' | 'plan_generator' | 'benefits_summary' | 'finish' | 'other';
  milestoneName: string;
  confidence: number; // 0-1
  
  // Extracted Data
  leadData?: {
    firstName?: string;
    lastName?: string;
    clientName?: string;
    phone?: string;
    city?: string;
    age?: number;
    state?: string;
    zip?: string;
    tobaccoUser?: boolean;
    leadType?: string;
  };
  
  quoteData?: Array<{
    carrier: string;
    productName: string;
    coverageAmount: number;
    monthlyPremium: number;
    annualPremium?: number;
  }>;
  
  productData?: Array<{
    productType: string;
    carrier: string;
    productName: string;
  }>;
  
  enrollmentData?: {
    applicationStarted: boolean;
    personalInfoComplete: boolean;
    healthQuestionsComplete: boolean;
    beneficiaryAdded: boolean;
    paymentMethodAdded: boolean;
    esignatureComplete: boolean;
  };
  
  analyticsData?: {
    totalDuration?: number;
    leadsReviewed?: number;
    quotesGenerated?: number;
    applicationsStarted?: number;
    applicationsCompleted?: number;
    saleMade?: boolean;
    premiumSold?: number;
    products?: string[];
    carriers?: string[];
  };
}

class HPProAnalyzer {
  
  /**
   * Analyze a single screenshot using ChatGPT Vision
   */
  async analyzeScreenshot(screenshotBase64: string): Promise<HPProScreenAnalysis> {
    // ENABLED: HPPRO screenshot analysis uses OpenAI
    if (!openAIClient) {
      throw new Error('OpenAI API key not configured. Please check hardcoded-config.ts');
    }
    
    try {
      console.log('\n🤖 ===== STARTING REALTIME AI ANALYSIS =====');
      console.log('🔑 API Key Status: ' + (openAIClient?.apiKey ? `Active (${openAIClient.apiKey.substring(0, 20)}...)` : 'MISSING!'));
      console.log('📊 Screenshot Size:', screenshotBase64?.length || 0, 'bytes');
      console.log('🎯 Model: gpt-4o-mini with Vision');
      
      const prompt = `You are analyzing a screenshot from an HPPRO insurance presentation system.

EXTRACT ALL VISIBLE DATA FROM ANY INPUT FIELDS, DROPDOWNS, AMOUNTS, OR FILLED-IN VALUES:

**GROUP CODE & MATERIALS:**
- group_code (if visible, e.g., "SGO92")

**SPONSORSHIP PROGRAM:**
- sponsor_first_name, sponsor_last_name, sponsor_organization
- sponsor_phone, sponsor_email, sponsorship_date
- total_gifted (dollar amount)
- benefit_type, branch_of_service
- sponsored_first_name, sponsored_last_name, sponsored_city, sponsored_state, sponsored_phone
- relationship_to_sponsor, occupation, significant_other

**PRIMARY CLIENT (NEEDS ANALYSIS):**
- primary_first_name, primary_last_name, primary_dob, primary_age
- primary_status (e.g., "RETIRED"), primary_gender, primary_email, primary_phone, primary_zip

**SPOUSE INFO:**
- spouse_first_name, spouse_last_name, spouse_dob, spouse_occupation, spouse_gender

**FAMILY:**
- has_dependent_children (true/false)

**LIFE INSURANCE THROUGH WORK (Primary & Spouse):**
- primary_work_whole_life, primary_work_term_life, primary_work_accidental, primary_work_group
- spouse_work_whole_life, spouse_work_term_life, spouse_work_accidental, spouse_work_group

**LIFE INSURANCE OUTSIDE WORK (Primary & Spouse):**
- primary_outside_whole_life, primary_outside_term_life, primary_outside_accidental, primary_outside_group
- spouse_outside_whole_life, spouse_outside_term_life, spouse_outside_accidental, spouse_outside_group

**HOMEOWNERSHIP:**
- home_status ("OWN" or "RENT"), monthly_payment, mortgage_balance, mortgage_interest_rate, mortgage_years_remaining
- has_death_insurance (true/false), death_insurance_amount
- has_college_provision (true/false), college_provision_amount

**HOUSEHOLD:**
- household_type (e.g., "SINGLE"), banks_locally_checking, banks_locally_savings

**PLAN GENERATOR:**
- primary_hourly_wage, primary_terminated_unemployed, primary_has_children_under_18
- spouse_hourly_wage, spouse_terminated_unemployed, spouse_has_children_under_18
- allocation_hour_power, allocation_monthly, allocation_dollar_a_day, allocation_need
- primary_contribution, remaining_daily, remaining_monthly, used_daily, used_monthly, wage_daily, wage_monthly

**PLAN LEVELS:**
- enhanced_monthly, recommended_monthly, basic_monthly

**PRODUCTS (ALL Products with their details):**
For EACH product visible (A71000, SRGWL, 10YRC, ADB, WHL, etc), extract:
- product_name_added (true/false if checkbox checked)
- product_name_coverage (dollar amount)
- product_name_option (dropdown selection)
- product_name_present_as (how it's presented)
- product_name_daily_cost, product_name_mbd, product_name_alp, product_name_ahp

**BENEFITS SUMMARY:**
- selected_plan ("ENHANCED", "RECOMMENDED", or "BASIC")
- summary_daily, summary_mbd, when_something_happens, beneficiary_name
- emergency_room_benefit, daily_hospital_benefit, intensive_care_benefit
- any_cause_of_death, accident_death, auto_accident_death, common_carrier_death

**FINISH PRESENTATION:**
- presentation_outcome ("ENROLLMENT", "NOT INTERESTED", "THINK", "JUST NO-COST", "QUALIFY", "TRAINING", "AFFORD", "POSTPONED")
- field_training_status ("ALONE" or other)
- vso_enrollment (true/false), presentation_notes
- market_type ("VETERAN" etc), presentation_date, sub_type ("RETURN CARD" etc)
- total_presentation_time, premium_approach, combined_daily_premium
- selected_plan_alp, selected_plan_ahp
- no_cost_benefits_duration, needs_analysis_duration, plan_generator_duration, present_plan_duration, benefit_summary_duration, eapp_duration, report_card_duration

**AGENT INFO:**
- agent_name, agent_license, agent_opeiu

Respond in JSON format with ALL fields matching database column names exactly.
Only include fields that are visible on this screen:
{
  "milestone": "intro|sponsorship|needs_analysis|plan_generator|benefits_summary|finish|other",
  "milestoneName": "descriptive name",
  "confidence": 0.0-1.0,
  "group_code": "...",
  "sponsor_first_name": "...",
  "sponsor_last_name": "...",
  "sponsor_organization": "...",
  "sponsor_phone": "...",
  "sponsor_email": "...",
  "total_gifted": 0.00,
  "primary_first_name": "...",
  "primary_last_name": "...",
  "primary_age": 0,
  "primary_email": "...",
  "primary_phone": "...",
  "primary_zip": "...",
  "spouse_first_name": "...",
  "spouse_last_name": "...",
  "product_a71000_coverage": 0.00,
  "product_srgwl_coverage": 0.00,
  "enhanced_monthly": 0.00,
  "recommended_monthly": 0.00,
  "basic_monthly": 0.00,
  "selected_plan": "ENHANCED|RECOMMENDED|BASIC",
  "when_something_happens": 0.00,
  "emergency_room_benefit": 0.00,
  "presentation_outcome": "ENROLLMENT|NOT INTERESTED|etc",
  "total_presentation_time": "..."
  ... (include ANY other fields you see with exact database column names)
}

CRITICAL: Use exact database column names, extract ALL visible amounts and data!`;

      console.log('📤 Sending screenshot to OpenAI for analysis...');
      const startTime = Date.now();
      
      const response = await openAIClient.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: screenshotBase64.startsWith('data:') ? screenshotBase64 : `data:image/png;base64,${screenshotBase64}`,
                  detail: 'high' // High detail for HPPRO data extraction
                }
              }
            ]
          }
        ],
        max_tokens: 1000,
        temperature: 0.1 // Low temperature for accuracy
      });
      
      const duration = Date.now() - startTime;
      console.log(`✅ OpenAI response received in ${duration}ms`);

      const content = response.choices[0]?.message?.content;
      if (!content) {
        console.error('❌ No content in OpenAI response!');
        throw new Error('No response from ChatGPT Vision');
      }

      console.log('📝 AI Response received, length:', content.length, 'chars');

      // Parse JSON response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('❌ Could not parse JSON from AI response!');
        console.error('Response content:', content.substring(0, 500));
        throw new Error('Invalid JSON response from AI');
      }

      const analysis: HPProScreenAnalysis = JSON.parse(jsonMatch[0]);
      console.log(`✅ ===== AI ANALYSIS COMPLETE =====`);
      console.log(`   Milestone: ${analysis.milestone} - ${analysis.milestoneName}`);
      console.log(`   Confidence: ${(analysis.confidence * 100).toFixed(1)}%\n`);
      
      return analysis;

    } catch (error: any) {
      console.error('\n❌❌❌ ===== AI ANALYSIS ERROR =====');
      console.error('   Error Type:', error.name);
      console.error('   Error Message:', error.message);
      if (error.response) {
        console.error('   API Response Status:', error.response.status);
        console.error('   API Response Data:', JSON.stringify(error.response.data).substring(0, 500));
      }
      console.error('   Stack:', error.stack);
      console.error('===== END ERROR =====\n');
      
      // Re-throw instead of returning default - this way errors are visible!
      throw error;
    }
  }

  /**
   * Helper to get session UUID from session_id string
   */
  async getSessionUUID(sessionId: string): Promise<string | null> {
    try {
      const { data: session, error } = await supabaseAdmin
        .from('presentation_sessions')
        .select('id')
        .eq('session_id', sessionId)
        .single();
      
      if (error || !session) {
        console.error(`❌ Could not find session UUID for session_id: ${sessionId}`);
        return null;
      }
      
      return session.id;
    } catch (error) {
      console.error('❌ Error looking up session UUID:', error);
      return null;
    }
  }

  /**
   * Save milestone to database
   */
  async saveMilestone(sessionId: string, analysis: HPProScreenAnalysis, screenshotId: string) {
    try {
      // Get UUID for foreign key reference
      const sessionUUID = await this.getSessionUUID(sessionId);
      if (!sessionUUID) {
        console.error(`❌ Cannot save milestone - no session UUID found for ${sessionId}`);
        return;
      }

      const { error } = await supabaseAdmin
        .from('hppro_presentation_milestones')
        .insert({
          session_id: sessionUUID, // Use UUID for foreign key
          milestone_type: analysis.milestone,
          milestone_name: analysis.milestoneName,
          screen_data: analysis as any,
          screenshot_id: screenshotId
        });

      if (error) throw error;
      console.log(`✅ Saved milestone: ${analysis.milestoneName} for session ${sessionId}`);
    } catch (error) {
      console.error('❌ Error saving milestone:', error);
    }
  }

  /**
   * Save lead selection data
   */
  async saveLeadData(sessionId: string, leadData: any) {
    if (!leadData) return;

    try {
      const sessionUUID = await this.getSessionUUID(sessionId);
      if (!sessionUUID) return;

      const { error } = await supabaseAdmin
        .from('hppro_lead_selection')
        .insert({
          session_id: sessionUUID,
          client_name: leadData.clientName,
          client_age: leadData.age,
          client_state: leadData.state,
          client_zip: leadData.zip,
          tobacco_user: leadData.tobaccoUser
        });

      if (error) throw error;
      console.log(`✅ Saved lead data for session ${sessionId}`);
    } catch (error) {
      console.error('❌ Error saving lead data:', error);
    }
  }

  /**
   * Save quote data
   */
  async saveQuotes(sessionId: string, quotes: any[]) {
    if (!quotes || quotes.length === 0) return;

    try {
      const sessionUUID = await this.getSessionUUID(sessionId);
      if (!sessionUUID) return;

      const quoteRecords = quotes.map((quote, index) => ({
        session_id: sessionUUID,
        carrier: quote.carrier,
        product_name: quote.productName,
        coverage_amount: quote.coverageAmount,
        monthly_premium: quote.monthlyPremium,
        annual_premium: quote.annualPremium,
        quote_position: index + 1
      }));

      const { error } = await supabaseAdmin
        .from('hppro_price_quotes')
        .insert(quoteRecords);

      if (error) throw error;
      console.log(`✅ Saved ${quotes.length} quotes for session ${sessionId}`);
    } catch (error) {
      console.error('❌ Error saving quotes:', error);
    }
  }

  /**
   * Save product discussion data
   */
  async saveProducts(sessionId: string, products: any[]) {
    if (!products || products.length === 0) return;

    try {
      const sessionUUID = await this.getSessionUUID(sessionId);
      if (!sessionUUID) return;

      const productRecords = products.map(product => ({
        session_id: sessionUUID,
        product_type: product.productType,
        carrier: product.carrier,
        product_name: product.productName
      }));

      const { error } = await supabaseAdmin
        .from('hppro_products_discussed')
        .insert(productRecords);

      if (error) throw error;
      console.log(`✅ Saved ${products.length} products for session ${sessionId}`);
    } catch (error) {
      console.error('❌ Error saving products:', error);
    }
  }

  /**
   * Save enrollment data
   */
  async saveEnrollmentData(sessionId: string, enrollmentData: any) {
    if (!enrollmentData) return;

    try {
      const sessionUUID = await this.getSessionUUID(sessionId);
      if (!sessionUUID) return;

      const { error } = await supabaseAdmin
        .from('hppro_enrollment_data')
        .upsert({
          session_id: sessionUUID,
          application_started: enrollmentData.applicationStarted,
          personal_info_completed: enrollmentData.personalInfoComplete,
          health_questions_completed: enrollmentData.healthQuestionsComplete,
          beneficiary_added: enrollmentData.beneficiaryAdded,
          payment_method_added: enrollmentData.paymentMethodAdded,
          esignature_completed: enrollmentData.esignatureComplete
        }, {
          onConflict: 'session_id'
        });

      if (error) throw error;
      console.log(`✅ Saved enrollment data for session ${sessionId}`);
    } catch (error) {
      console.error('❌ Error saving enrollment data:', error);
    }
  }

  /**
   * Save analytics summary (final screen)
   */
  async saveAnalyticsSummary(sessionId: string, analyticsData: any) {
    if (!analyticsData) return;

    try {
      const sessionUUID = await this.getSessionUUID(sessionId);
      if (!sessionUUID) return;

      const { error } = await supabaseAdmin
        .from('hppro_analytics_summary')
        .insert({
          session_id: sessionUUID,
          total_duration_minutes: analyticsData.totalDuration,
          leads_reviewed: analyticsData.leadsReviewed,
          total_quotes_generated: analyticsData.quotesGenerated,
          applications_started: analyticsData.applicationsStarted,
          applications_completed: analyticsData.applicationsCompleted,
          sale_made: analyticsData.saleMade,
          premium_sold: analyticsData.premiumSold,
          products_presented: analyticsData.products,
          carriers_shown: analyticsData.carriers
        });

      if (error) throw error;
      console.log(`✅ Saved analytics summary for session ${sessionId}`);
    } catch (error) {
      console.error('❌ Error saving analytics summary:', error);
    }
  }

  /**
   * Update presentation session with ALL comprehensive fields from AI analysis
   */
  async updateSessionData(sessionId: string, analysis: any) {
    try {
      console.log(`📊 Updating session with comprehensive data...`);
      console.log(`🔑 Session ID received: ${sessionId}`);
      
      // CRITICAL FIX: Look up the session by session_id (string) first to get the UUID
      const { data: session, error: lookupError } = await supabaseAdmin
        .from('presentation_sessions')
        .select('id')
        .eq('session_id', sessionId)
        .single();
      
      if (lookupError || !session) {
        console.error(`❌ Could not find session with session_id: ${sessionId}`);
        console.error(`   Error:`, lookupError);
        return;
      }
      
      const sessionUUID = session.id;
      console.log(`✅ Found session UUID: ${sessionUUID}`);
      
      // Extract ALL fields from the AI response and map them directly to database columns
      const updateData: any = {};
      
      // Simply copy all fields from the analysis response to updateData
      // The AI returns data with field names matching our database columns
      for (const [key, value] of Object.entries(analysis)) {
        if (value !== null && value !== undefined && key !== 'milestone' && key !== 'milestoneName' && key !== 'confidence') {
          updateData[key] = value;
        }
      }
      
      // Add current phase for tracking
      updateData.current_phase = analysis.milestone || 'unknown';
      updateData.phase_updated_at = new Date().toISOString();
      
      // Log what we're updating
      const fieldsUpdating = Object.keys(updateData).filter(k => updateData[k] !== null);
      console.log(`📋 Updating ${fieldsUpdating.length} fields:`, fieldsUpdating.slice(0, 10).join(', '), fieldsUpdating.length > 10 ? `... +${fieldsUpdating.length - 10} more` : '');

      console.log(`🔄 Updating session UUID: ${sessionUUID} with phase: ${analysis.milestone}`);

      const { error } = await supabaseAdmin
        .from('presentation_sessions')
        .update(updateData)
        .eq('id', sessionUUID);

      if (error) {
        console.error('❌ Supabase update error:', error);
        console.error('   Update data keys:', Object.keys(updateData));
        throw error;
      }
      
      console.log(`✅ Updated session ${sessionId} (UUID: ${sessionUUID}) successfully with ${fieldsUpdating.length} fields!`);
    } catch (error) {
      console.error('❌ Error updating session data:', error);
      throw error; // Re-throw so we can see it in logs
    }
  }

  /**
   * Analyze and save a screenshot
   */
  async processScreenshot(sessionId: string, screenshotId: string, screenshotBase64: string) {
    console.log(`🔍 Analyzing screenshot ${screenshotId} for session ${sessionId}...`);
    
    // Analyze with AI
    const analysis = await this.analyzeScreenshot(screenshotBase64);
    
    console.log(`📊 Analysis result: ${analysis.milestone} - ${analysis.milestoneName} (confidence: ${analysis.confidence})`);
    
    // Update main session with client data and phase
    await this.updateSessionData(sessionId, analysis);
    
    // Save milestone
    await this.saveMilestone(sessionId, analysis, screenshotId);
    
    // Save extracted data based on milestone type
    if (analysis.leadData) {
      await this.saveLeadData(sessionId, analysis.leadData);
    }
    
    if (analysis.quoteData && analysis.quoteData.length > 0) {
      await this.saveQuotes(sessionId, analysis.quoteData);
    }
    
    if (analysis.productData && analysis.productData.length > 0) {
      await this.saveProducts(sessionId, analysis.productData);
    }
    
    if (analysis.enrollmentData) {
      await this.saveEnrollmentData(sessionId, analysis.enrollmentData);
    }
    
    if (analysis.analyticsData) {
      await this.saveAnalyticsSummary(sessionId, analysis.analyticsData);
    }
    
    return analysis;
  }
}

export const hpproAnalyzer = new HPProAnalyzer();

