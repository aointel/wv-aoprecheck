import { supabaseAdmin } from './supabase';

class HPProCompletionTransfer {
  /**
   * Transfer completed presentation data to hppro_presentation_complete table
   */
  async transferCompletedPresentation(sessionId: string): Promise<void> {
    try {
      console.log(`📦 Transferring completed presentation ${sessionId} to hppro_presentation_complete...`);
      
      // Get the presentation session with all data
      const { data: session, error: sessionError } = await supabaseAdmin
        .from('presentation_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();
      
      if (sessionError || !session) {
        console.error('❌ Failed to fetch session:', sessionError);
        return;
      }
      
      // Check if already transferred
      const { data: existing } = await supabaseAdmin
        .from('hppro_presentation_complete')
        .select('id')
        .eq('session_id', sessionId)
        .single();
      
      if (existing) {
        console.log('✅ Already transferred, updating existing record...');
      }
      
      // Build the complete record
      const completeRecord: any = {
        session_id: sessionId,
        agent_email: session.agent_email,
        agent_name: session.agent_name,
        agent_license: session.agent_license,
        agent_opeiu: session.agent_opeiu,
        associate_id: session.associate_id,
        presentation_url: session.presentation_url,
        presentation_date: session.started_at,
        total_presentation_time: session.duration_seconds ? `${Math.floor(session.duration_seconds / 60)} minutes` : null,
        market_type: session.market_type,
        sub_type: session.sub_type,
        presentation_outcome: session.presentation_outcome,
        field_training_status: session.field_training_status,
        vso_enrollment: session.vso_enrollment,
        presentation_notes: session.presentation_notes,
        
        // Copy all extracted fields from session
        group_code: session.group_code,
        sponsor_first_name: session.sponsor_first_name,
        sponsor_last_name: session.sponsor_last_name,
        sponsor_organization: session.sponsor_organization,
        sponsor_phone: session.sponsor_phone,
        sponsor_email: session.sponsor_email,
        sponsorship_date: session.sponsorship_date,
        total_gifted: session.total_gifted,
        benefit_type: session.benefit_type,
        branch_of_service: session.branch_of_service,
        sponsored_first_name: session.sponsored_first_name,
        sponsored_last_name: session.sponsored_last_name,
        sponsored_city: session.sponsored_city,
        sponsored_state: session.sponsored_state,
        sponsored_phone: session.sponsored_phone,
        relationship_to_sponsor: session.relationship_to_sponsor,
        occupation: session.occupation,
        significant_other: session.significant_other,
        
        primary_first_name: session.primary_first_name,
        primary_last_name: session.primary_last_name,
        primary_dob: session.primary_dob,
        primary_age: session.primary_age,
        primary_status: session.primary_status,
        primary_gender: session.primary_gender,
        primary_email: session.primary_email,
        primary_phone: session.primary_phone,
        primary_zip: session.primary_zip,
        
        spouse_first_name: session.spouse_first_name,
        spouse_last_name: session.spouse_last_name,
        spouse_dob: session.spouse_dob,
        spouse_occupation: session.spouse_occupation,
        spouse_gender: session.spouse_gender,
        
        has_dependent_children: session.has_dependent_children,
        
        // Insurance through work
        primary_work_whole_life: session.primary_work_whole_life,
        primary_work_term_life: session.primary_work_term_life,
        primary_work_accidental: session.primary_work_accidental,
        primary_work_group: session.primary_work_group,
        spouse_work_whole_life: session.spouse_work_whole_life,
        spouse_work_term_life: session.spouse_work_term_life,
        spouse_work_accidental: session.spouse_work_accidental,
        spouse_work_group: session.spouse_work_group,
        
        // Insurance outside work
        primary_outside_whole_life: session.primary_outside_whole_life,
        primary_outside_term_life: session.primary_outside_term_life,
        primary_outside_accidental: session.primary_outside_accidental,
        primary_outside_group: session.primary_outside_group,
        spouse_outside_whole_life: session.spouse_outside_whole_life,
        spouse_outside_term_life: session.spouse_outside_term_life,
        spouse_outside_accidental: session.spouse_outside_accidental,
        spouse_outside_group: session.spouse_outside_group,
        
        // Homeownership
        home_status: session.home_status,
        monthly_payment: session.monthly_payment,
        mortgage_balance: session.mortgage_balance,
        mortgage_interest_rate: session.mortgage_interest_rate,
        mortgage_years_remaining: session.mortgage_years_remaining,
        has_death_insurance: session.has_death_insurance,
        death_insurance_amount: session.death_insurance_amount,
        has_college_provision: session.has_college_provision,
        college_provision_amount: session.college_provision_amount,
        
        household_type: session.household_type,
        banks_locally_checking: session.banks_locally_checking,
        banks_locally_savings: session.banks_locally_savings,
        
        // Plan Generator
        primary_hourly_wage: session.primary_hourly_wage,
        primary_terminated_unemployed: session.primary_terminated_unemployed,
        primary_has_children_under_18: session.primary_has_children_under_18,
        spouse_hourly_wage: session.spouse_hourly_wage,
        spouse_terminated_unemployed: session.spouse_terminated_unemployed,
        spouse_has_children_under_18: session.spouse_has_children_under_18,
        allocation_hour_power: session.allocation_hour_power,
        allocation_monthly: session.allocation_monthly,
        allocation_dollar_a_day: session.allocation_dollar_a_day,
        allocation_need: session.allocation_need,
        primary_contribution: session.primary_contribution,
        remaining_daily: session.remaining_daily,
        remaining_monthly: session.remaining_monthly,
        used_daily: session.used_daily,
        used_monthly: session.used_monthly,
        wage_daily: session.wage_daily,
        wage_monthly: session.wage_monthly,
        
        // Plan Levels
        enhanced_monthly: session.enhanced_monthly,
        recommended_monthly: session.recommended_monthly,
        basic_monthly: session.basic_monthly,
        
        // Products (collect all product fields into JSONB)
        products: this.extractProductsFromSession(session),
        
        // Benefits Summary
        selected_plan: session.selected_plan,
        summary_daily: session.summary_daily,
        summary_mbd: session.summary_mbd,
        when_something_happens: session.when_something_happens,
        beneficiary_name: session.beneficiary_name,
        emergency_room_benefit: session.emergency_room_benefit,
        daily_hospital_benefit: session.daily_hospital_benefit,
        intensive_care_benefit: session.intensive_care_benefit,
        any_cause_of_death: session.any_cause_of_death,
        accident_death: session.accident_death,
        auto_accident_death: session.auto_accident_death,
        common_carrier_death: session.common_carrier_death,
        
        premium_approach: session.premium_approach,
        combined_daily_premium: session.combined_daily_premium,
        selected_plan_alp: session.selected_plan_alp,
        selected_plan_ahp: session.selected_plan_ahp,
        
        // Duration tracking
        no_cost_benefits_duration: session.no_cost_benefits_duration,
        needs_analysis_duration: session.needs_analysis_duration,
        plan_generator_duration: session.plan_generator_duration,
        present_plan_duration: session.present_plan_duration,
        benefit_summary_duration: session.benefit_summary_duration,
        eapp_duration: session.eapp_duration,
        report_card_duration: session.report_card_duration,
        
        // AI Analysis
        ai_summary: session.ai_summary,
        key_topics: session.key_topics,
        engagement_score: session.engagement_score,
        
        updated_at: new Date().toISOString()
      };
      
      // Upsert to hppro_presentation_complete
      const { error: upsertError } = await supabaseAdmin
        .from('hppro_presentation_complete')
        .upsert(completeRecord, {
          onConflict: 'session_id'
        });
      
      if (upsertError) {
        console.error('❌ Failed to transfer to hppro_presentation_complete:', upsertError);
        throw upsertError;
      }
      
      console.log(`✅ Successfully transferred presentation ${sessionId} to hppro_presentation_complete`);
    } catch (error) {
      console.error('❌ Error transferring presentation:', error);
      throw error;
    }
  }
  
  /**
   * Extract all product-related fields from session into a JSONB object
   */
  private extractProductsFromSession(session: any): any {
    const products: any = {};
    
    // List of known products
    const productCodes = [
      'a71000', 'srgwl', '10yrc', 'adb', 'whl', 'pgul', 'wacc',
      'hib', 'cic', 'ci', 'lsi', 'vb', 'woi', 'tl', 'graded'
    ];
    
    for (const code of productCodes) {
      const productData: any = {};
      const prefix = `product_${code}_`;
      
      // Check for product fields
      if (session[`${prefix}added`] !== undefined) productData.added = session[`${prefix}added`];
      if (session[`${prefix}coverage`] !== undefined) productData.coverage = session[`${prefix}coverage`];
      if (session[`${prefix}option`] !== undefined) productData.option = session[`${prefix}option`];
      if (session[`${prefix}present_as`] !== undefined) productData.present_as = session[`${prefix}present_as`];
      if (session[`${prefix}daily_cost`] !== undefined) productData.daily_cost = session[`${prefix}daily_cost`];
      if (session[`${prefix}mbd`] !== undefined) productData.mbd = session[`${prefix}mbd`];
      if (session[`${prefix}alp`] !== undefined) productData.alp = session[`${prefix}alp`];
      if (session[`${prefix}ahp`] !== undefined) productData.ahp = session[`${prefix}ahp`];
      
      if (Object.keys(productData).length > 0) {
        products[code] = productData;
      }
    }
    
    return Object.keys(products).length > 0 ? products : null;
  }
}

export const hpproCompletionTransfer = new HPProCompletionTransfer();

