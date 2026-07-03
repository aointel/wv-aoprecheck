import { supabaseAdmin } from './supabase';
import { masterleadClient } from "./local-masterlead-client";

export interface AgentCycleState {
  userEmail: string;
  currentPhase: 'masterlead' | 'hotlead';
  masterleadCallsCompleted: number;
  hotleadCallsCompleted: number;
  lastPhaseTransition: Date;
  totalCyclesCompleted: number;
  isInLightningRound: boolean;
}

export class CycleManagementService {
  private static readonly MASTERLEAD_PHASE_LIMIT = 25;
  private static readonly HOTLEAD_PHASE_LIMIT = 10;

  /**
   * Check agent's current cycle state and determine what type of leads to serve
   */
  static async getAgentCycleState(userEmail: string): Promise<AgentCycleState> {
    try {
      console.log(`🔄 CYCLE MANAGEMENT: Checking cycle state for ${userEmail}`);
      
      // Get TODAY's date range in EST timezone (SAME AS ANALYTICS AND LIGHTNING ROUND)
      const today = new Date();
      const est = new Date(today.toLocaleString("en-US", {timeZone: "America/New_York"}));
      const startOfDay = new Date(est.getFullYear(), est.getMonth(), est.getDate(), 0, 0, 0);
      const endOfDay = new Date(est.getFullYear(), est.getMonth(), est.getDate(), 23, 59, 59);
      
      // Count leads called TODAY using LEAD TAGGING SYSTEM (matches analytics)
      if (!supabaseAdmin) {
        console.error('❌ Supabase admin client not available');
        return {
          userEmail,
          currentPhase: 'masterlead' as const,
          masterleadCallsCompleted: 0,
          hotleadCallsCompleted: 0,
          lastPhaseTransition: new Date(),
          totalCyclesCompleted: 0,
          isInLightningRound: false,
        };
      }

      const { data: masterleadCalls, error: masterleadError } = await masterleadClient.from('masterlead')
        .select('id')
        .eq('cn_email', userEmail)
        .neq('cnresolution', 'AOresolve')
        .gte('last_contacted', startOfDay.toISOString())
        .lte('last_contacted', endOfDay.toISOString());

      if (masterleadError) {
        console.error('❌ Cycle Management error fetching masterlead calls:', masterleadError);
      }

      // Count hotleads called TODAY using LEAD TAGGING SYSTEM
      const { data: hotleadCalls, error: hotleadError } = await masterleadClient.from('masterlead')
        .select('id')
        .eq('cn_email', userEmail)
        .neq('cnresolution', 'AOresolve')
        .gte('last_contacted', startOfDay.toISOString())
        .lte('last_contacted', endOfDay.toISOString());

      if (hotleadError) {
        console.error('❌ Cycle Management error fetching hotlead calls:', hotleadError);
      }

      const masterleadCallsCompleted = masterleadCalls?.length || 0;
      const hotleadCallsCompleted = hotleadCalls?.length || 0;

      // Determine current phase based on completion counts
      let currentPhase: 'masterlead' | 'hotlead' = 'masterlead';
      let isInLightningRound = false;

      if (masterleadCallsCompleted >= this.MASTERLEAD_PHASE_LIMIT) {
        // Agent has completed 25+ masterlead calls, should be in hotlead phase
        currentPhase = 'hotlead';
        isInLightningRound = true;
        
        if (hotleadCallsCompleted >= this.HOTLEAD_PHASE_LIMIT) {
          // Agent has completed both phases, reset to masterlead
          currentPhase = 'masterlead';
          isInLightningRound = false;
        }
      }

      const cycleState: AgentCycleState = {
        userEmail,
        currentPhase,
        masterleadCallsCompleted,
        hotleadCallsCompleted,
        lastPhaseTransition: new Date(),
        totalCyclesCompleted: Math.floor((masterleadCallsCompleted + hotleadCallsCompleted) / (this.MASTERLEAD_PHASE_LIMIT + this.HOTLEAD_PHASE_LIMIT)),
        isInLightningRound
      };

      console.log(`🔄 CYCLE MANAGEMENT: ${userEmail} - Phase: ${currentPhase}, Masterleads: ${masterleadCallsCompleted}/${this.MASTERLEAD_PHASE_LIMIT}, Hotleads: ${hotleadCallsCompleted}/${this.HOTLEAD_PHASE_LIMIT}, Lightning Round: ${isInLightningRound}`);

      return cycleState;

    } catch (error) {
      console.error('❌ Error getting agent cycle state:', error);
      // Return default state on error
      return {
        userEmail,
        currentPhase: 'masterlead',
        masterleadCallsCompleted: 0,
        hotleadCallsCompleted: 0,
        lastPhaseTransition: new Date(),
        totalCyclesCompleted: 0,
        isInLightningRound: false
      };
    }
  }

  /**
   * Get the appropriate leads for the agent based on their current cycle phase
   */
  static async getLeadsForCurrentPhase(userEmail: string): Promise<{
    leads: any[];
    phase: 'masterlead' | 'hotlead';
    isLightningRound: boolean;
    message: string;
  }> {
    try {
      const cycleState = await this.getAgentCycleState(userEmail);
      
      if (cycleState.isInLightningRound) {
        // Lightning Round: Serve hotleads
        console.log(`⚡ LIGHTNING ROUND: ${userEmail} is in hotlead phase, serving hotleads`);
        
        if (!supabaseAdmin) {
          console.error('❌ Supabase admin client not available for hotleads');
          return { leads: [], phase: 'hotlead', isLightningRound: true, message: 'Supabase admin client not available' };
        }

        const { data: hotleads, error } = await supabaseAdmin
          .from('hotleads')
          .select('*')
          .eq('cn_email', userEmail)
          .eq('cnresolution', 'assigned')
          .order('assigned_at', { ascending: false })
          .limit(this.HOTLEAD_PHASE_LIMIT);

        if (error) {
          console.error('❌ Error fetching hotleads:', error);
          return { leads: [], phase: 'hotlead', isLightningRound: true, message: 'Error loading hotleads' };
        }

        const formattedHotleads = (hotleads || []).map((lead: any) => ({
          id: lead.id,
          name: `${lead.first_name} ${lead.last_name}`,
          phone: lead.phone,
          state: lead.taalk_state || null,
          market: lead.taalk_market || null,
          taalk_market: lead.taalk_market || null,
          leadId: lead.id, // Use database primary key
          taalk_lead_id: lead.taalk_lead_id,
          groupCode: lead.taalk_group_code || null,
          groupName: lead.taalk_groupname || null,
          city: lead.taalk_city || lead.city || null,
          status: lead.cnresolution,
          position: -1,
          beneficiary: lead.taalk_beneficiary || null,
          relationship: lead.taalk_relationship || null,
          referredBy: lead.taalk_reffered || null,
          sponsorOrg: lead.taalk_sponsor_org || null,
          isHotLead: true,
          source_table: 'hotleads',
          email: lead.taalk_email || '',
          leadType: 'hotlead',
          priority: 1
        }));

        return {
          leads: formattedHotleads,
          phase: 'hotlead',
          isLightningRound: true,
          message: `Lightning Round: ${formattedHotleads.length} hotleads loaded`
        };

      } else {
        // Normal Phase: Serve masterleads
        console.log(`📋 NORMAL PHASE: ${userEmail} is in masterlead phase, serving masterleads`);
        
        if (!supabaseAdmin) {
          console.error('❌ Supabase admin client not available for masterleads');
          return { leads: [], phase: 'masterlead', isLightningRound: false, message: 'Supabase admin client not available' };
        }

        const { data: masterleads, error } = await masterleadClient.from('masterlead')
          .select('*')
          .eq('cn_email', userEmail)
          .order('called_at', { ascending: false, nullsFirst: true })
          .limit(this.MASTERLEAD_PHASE_LIMIT);

        if (error) {
          console.error('❌ Error fetching masterleads:', error);
          return { leads: [], phase: 'masterlead', isLightningRound: false, message: 'Error loading masterleads' };
        }

        const formattedMasterleads = (masterleads || []).map((lead: any) => ({
          id: lead.id,
          name: `${lead.first_name} ${lead.last_name}`,
          phone: lead.phone,
          state: lead.taalk_state || null,
          market: lead.taalk_market || null,
          taalk_market: lead.taalk_market || null,
          leadId: lead.id, // Use database primary key
          taalk_lead_id: lead.taalk_lead_id,
          groupCode: lead.taalk_group_code || null,
          groupName: lead.taalk_groupname || null,
          city: lead.taalk_city || lead.city || null,
          status: lead.status,
          position: lead.position || -1,
          beneficiary: lead.taalk_beneficiary || null,
          relationship: lead.taalk_relationship || null,
          referredBy: lead.taalk_reffered || null,
          sponsorOrg: lead.taalk_sponsor_org || null,
          isHotLead: false,
          source_table: 'masterlead',
          email: lead.email || '',
          leadType: 'masterlead',
          priority: 2
        }));

        return {
          leads: formattedMasterleads,
          phase: 'masterlead',
          isLightningRound: false,
          message: `Normal Phase: ${formattedMasterleads.length} masterleads loaded`
        };
      }

    } catch (error) {
      console.error('❌ Error getting leads for current phase:', error);
      return { leads: [], phase: 'masterlead', isLightningRound: false, message: 'Error determining phase' };
    }
  }

  /**
   * Check if agent should transition to next phase
   */
  static async shouldTransitionPhase(userEmail: string): Promise<boolean> {
    const cycleState = await this.getAgentCycleState(userEmail);
    
    if (cycleState.currentPhase === 'masterlead' && cycleState.masterleadCallsCompleted >= this.MASTERLEAD_PHASE_LIMIT) {
      return true; // Should transition to hotlead phase
    }
    
    if (cycleState.currentPhase === 'hotlead' && cycleState.hotleadCallsCompleted >= this.HOTLEAD_PHASE_LIMIT) {
      return true; // Should transition back to masterlead phase
    }
    
    return false;
  }

  /**
   * Get cycle progress information for display
   */
  static async getCycleProgress(userEmail: string): Promise<{
    currentPhase: string;
    progress: number;
    totalInPhase: number;
    completedInPhase: number;
    nextPhase: string;
    estimatedTimeToNextPhase: string;
  }> {
    const cycleState = await this.getAgentCycleState(userEmail);
    
    let progress = 0;
    let totalInPhase = 0;
    let completedInPhase = 0;
    let nextPhase = '';
    
    if (cycleState.currentPhase === 'masterlead') {
      completedInPhase = cycleState.masterleadCallsCompleted;
      totalInPhase = this.MASTERLEAD_PHASE_LIMIT;
      nextPhase = 'Lightning Round (10 Hotleads)';
      progress = Math.min((completedInPhase / totalInPhase) * 100, 100);
    } else {
      completedInPhase = cycleState.hotleadCallsCompleted;
      totalInPhase = this.HOTLEAD_PHASE_LIMIT;
      nextPhase = 'Masterlead Phase (25 leads)';
      progress = Math.min((completedInPhase / totalInPhase) * 100, 100);
    }
    
    // Estimate time to next phase (assuming 3 minutes per call)
    const remainingCalls = totalInPhase - completedInPhase;
    const estimatedMinutes = remainingCalls * 3;
    const estimatedTimeToNextPhase = estimatedMinutes < 60 
      ? `${estimatedMinutes} minutes` 
      : `${Math.floor(estimatedMinutes / 60)} hours ${estimatedMinutes % 60} minutes`;
    
    return {
      currentPhase: cycleState.currentPhase === 'masterlead' ? 'Masterlead Phase (25 leads)' : 'Lightning Round (10 Hotleads)',
      progress: Math.round(progress),
      totalInPhase,
      completedInPhase,
      nextPhase,
      estimatedTimeToNextPhase
    };
  }
}

export default CycleManagementService;