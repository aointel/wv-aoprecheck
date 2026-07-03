import { db, pool } from './db.js';
import { supabase } from './supabase.js';

interface LightningRoundProgress {
  agentEmail: string;
  currentMilestone: number;
  validPlusLeadCalls: number;
  requiredCalls: number;
  lightningRoundActive: boolean;
  lastUpdated: Date;
}

interface PlusLeadCall {
  leadId: string;
  duration: number;
  timestamp: Date;
  isValid: boolean;
}

export class LightningRoundService {
  private static progressMap = new Map<string, LightningRoundProgress>();

  // Check if agent is in lightning round - UNIVERSAL AUTOMATIC VALIDATION
  static async isInLightningRound(agentEmail: string): Promise<boolean> {
    // Keep cnsysop disabled for system testing only
    if (agentEmail === 'cnsysop@aoglobelife.com') {
      return false;
    }
    
    const progress = this.progressMap.get(agentEmail);
    if (!progress?.lightningRoundActive) {
      return false;
    }
    
    // UNIVERSAL FIX: Auto-validate daily call count before returning Lightning Round status
    try {
      const dailyCallCount = await this.getTodayCallCount(agentEmail);
      if (dailyCallCount < 25) {
        console.log(`🚫 UNIVERSAL FIX: Clearing Lightning Round for ${agentEmail} - only ${dailyCallCount} calls today (need 25+)`);
        this.clearLightningRound(agentEmail);
        return false;
      }
      
      console.log(`✅ UNIVERSAL FIX: Lightning Round validated for ${agentEmail} - ${dailyCallCount} calls today`);
      return true;
      
    } catch (error) {
      console.error(`❌ UNIVERSAL FIX: Database error validating ${agentEmail}, defaulting to NO Lightning Round:`, error);
      this.clearLightningRound(agentEmail);
      return false;
    }
  }

  // Get today's call count for an agent using LEAD TAGGING SYSTEM (matches analytics)
  static async getTodayCallCount(agentEmail: string): Promise<number> {
    try {
      // Get TODAY's date range in EST timezone (same as analytics)
      const today = new Date();
      const est = new Date(today.toLocaleString("en-US", {timeZone: "America/New_York"}));
      const startOfDay = new Date(est.getFullYear(), est.getMonth(), est.getDate(), 0, 0, 0);
      const endOfDay = new Date(est.getFullYear(), est.getMonth(), est.getDate(), 23, 59, 59);

      // Count leads called TODAY from both masterlead and hotleads tables
      if (!supabase) {
        console.error('❌ Supabase client not available');
        return 0;
      }

      const { data: masterleads, error: masterError } = await supabase
        .from('masterlead')
        .select('id')
        .eq('cn_email', agentEmail)
        .neq('cnresolution', 'AOresolve')
        .gte('last_contacted', startOfDay.toISOString())
        .lte('last_contacted', endOfDay.toISOString());

      const { data: hotleads, error: hotError } = await supabase
        .from('masterlead')
        .select('id')
        .eq('cn_email', agentEmail)
        .neq('cnresolution', 'AOresolve')
        .gte('last_contacted', startOfDay.toISOString())
        .lte('last_contacted', endOfDay.toISOString());

      if (masterError) console.error(`❌ Lightning Round master leads error for ${agentEmail}:`, masterError);
      if (hotError) console.error(`❌ Lightning Round hot leads error for ${agentEmail}:`, hotError);

      const masterCount = masterleads?.length || 0;
      const hotCount = hotleads?.length || 0; 
      const totalCalls = masterCount + hotCount;
        
      console.log(`📊 LIGHTNING ROUND: ${agentEmail} called ${totalCalls} leads today (${masterCount} master + ${hotCount} hot)`);
      return totalCalls;
        
    } catch (error) {
      console.error(`❌ Lightning Round error getting daily call count for ${agentEmail}:`, error);
      return 0;
    }
  }

  // Start lightning round with UNIVERSAL VALIDATION
  static async startLightningRound(agentEmail: string, milestone: number): Promise<void> {
    // UNIVERSAL FIX: Validate daily call count BEFORE activation
    const dailyCallCount = await this.getTodayCallCount(agentEmail);
    
    if (dailyCallCount < 25) {
      console.log(`🚫 UNIVERSAL FIX: Cannot start Lightning Round for ${agentEmail} - only ${dailyCallCount} calls today (need 25+)`);
      return;
    }
    
    console.log(`⚡ UNIVERSAL FIX: Starting Lightning Round for ${agentEmail} at milestone ${milestone} - validated ${dailyCallCount} calls today`);
    
    this.progressMap.set(agentEmail, {
      agentEmail,
      currentMilestone: milestone,
      validPlusLeadCalls: 0,
      requiredCalls: 10,
      lightningRoundActive: true,
      lastUpdated: new Date()
    });
  }

  // Record ANY lead call attempt (plus leads OR hotleads)
  static async recordLeadCall(
    agentEmail: string, 
    leadId: string, 
    duration: number,
    leadType: 'plus' | 'hotlead' = 'plus'
  ): Promise<{ isValid: boolean; progress: LightningRoundProgress | null }> {
    const progress = this.progressMap.get(agentEmail);
    
    if (!progress || !progress.lightningRoundActive) {
      return { isValid: false, progress: null };
    }

    const isValid = duration >= 6; // 6+ seconds required
    
    if (isValid) {
      progress.validPlusLeadCalls++;
      progress.lastUpdated = new Date();
      
      console.log(`✅ Valid ${leadType} call recorded for ${agentEmail}: ${progress.validPlusLeadCalls}/${progress.requiredCalls}`);
      
      // Check if lightning round is complete
      if (progress.validPlusLeadCalls >= progress.requiredCalls) {
        await this.completeLightningRound(agentEmail);
      }
    } else {
      console.log(`❌ Invalid ${leadType} call for ${agentEmail}: ${duration}s (need 6+s) - doesn't count toward quota`);
      // Skipped calls simply don't count - no penalty, no extra leads added
    }

    return { isValid, progress };
  }

  // Clear/stop lightning round (for testing or manual reset)
  static clearLightningRound(agentEmail: string): void {
    console.log(`🚫 Clearing Lightning Round state for ${agentEmail}`);
    this.progressMap.delete(agentEmail);
  }

  // Complete lightning round and unlock next hot leads
  static async completeLightningRound(agentEmail: string): Promise<void> {
    const progress = this.progressMap.get(agentEmail);
    if (!progress) return;

    console.log(`🎉 Lightning round COMPLETED for ${agentEmail}! Unlocking next hot leads batch.`);
    
    progress.lightningRoundActive = false;
    progress.lastUpdated = new Date();
    
    // TODO: Trigger next hot leads batch unlock
    // This would integrate with your hotlead distribution system
  }

  // Add more leads when agent skips (prefer plus leads)
  static async addMoreLeads(agentEmail: string): Promise<void> {
    console.log(`📞 Adding more leads for ${agentEmail} (skipped previous call)`);
    
    // Query available leads that haven't been called in last 4 hours (prefer plus leads)
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
    
    try {
      if (!supabase) {
        console.error('❌ Supabase client not available for addMoreLeads');
        return;
      }

      // First try to get plus leads
      const { data: availablePlusLeads, error: plusError } = await supabase
        .from('masterlead')
        .select('*')
        .eq('lead_type', 'plus')
        .or(`last_called_at.is.null,last_called_at.lt.${fourHoursAgo.toISOString()}`)
        .limit(5);

      if (!plusError && availablePlusLeads && availablePlusLeads.length > 0) {
        console.log(`📞 Added ${availablePlusLeads.length} more plus leads for ${agentEmail}`);
        return;
      }

      // If no plus leads, try hotleads
      const { data: availableHotleads, error: hotError } = await supabase
        .from('hotlead')
        .select('*')
        .or(`last_called_at.is.null,last_called_at.lt.${fourHoursAgo.toISOString()}`)
        .limit(3); // Add fewer hotleads since they're higher priority

      if (!hotError && availableHotleads && availableHotleads.length > 0) {
        console.log(`📞 Added ${availableHotleads.length} hotleads for ${agentEmail} (no plus leads available)`);
        return;
      }

      // No leads available at all
      console.log(`✅ No more leads available for ${agentEmail} - allowing progression`);
      await this.completeLightningRound(agentEmail);
      
    } catch (error) {
      console.error('❌ Error in addMorePlusLeads:', error);
    }
  }

  // Get lightning round progress
  static getLightningRoundProgress(agentEmail: string): LightningRoundProgress | null {
    return this.progressMap.get(agentEmail) || null;
  }

  // Check if agent can advance to next milestone
  static async canAdvanceToNextMilestone(agentEmail: string): Promise<boolean> {
    const progress = this.progressMap.get(agentEmail);
    
    if (!progress || !progress.lightningRoundActive) {
      return true; // Not in lightning round, can advance
    }

    // Check if lightning round requirements are met
    if (progress.validPlusLeadCalls >= progress.requiredCalls) {
      return true;
    }

    // Check if no leads available (plus leads OR hotleads)
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
    
    try {
      if (!supabase) {
        console.error('❌ Supabase client not available for canAdvanceToNextMilestone');
        return false;
      }

      // Check plus leads first
      const { data: availablePlusLeads } = await supabase
        .from('masterlead')
        .select('id')
        .eq('lead_type', 'plus')
        .or(`last_called_at.is.null,last_called_at.lt.${fourHoursAgo.toISOString()}`)
        .limit(1);

      // Check hotleads
      const { data: availableHotleads } = await supabase
        .from('hotlead')
        .select('id')
        .or(`last_called_at.is.null,last_called_at.lt.${fourHoursAgo.toISOString()}`)
        .limit(1);

      const hasLeads = (availablePlusLeads && availablePlusLeads.length > 0) || 
                       (availableHotleads && availableHotleads.length > 0);

      if (!hasLeads) {
        console.log(`✅ No leads available for ${agentEmail} - allowing advancement`);
        await this.completeLightningRound(agentEmail);
        return true;
      }

      return false; // Still have leads available, must complete lightning round
      
    } catch (error) {
      console.error('❌ Error checking advancement eligibility:', error);
      return false;
    }
  }

  // Reset lightning round (for testing or admin purposes)
  static resetLightningRound(agentEmail: string): void {
    this.progressMap.delete(agentEmail);
    console.log(`🔄 Lightning round reset for ${agentEmail}`);
  }

  // UNIVERSAL FIX: Clear ALL Lightning Round states for all agents
  static clearAllLightningRounds(): void {
    const totalCleared = this.progressMap.size;
    const agentEmails = Array.from(this.progressMap.keys());
    
    this.progressMap.clear();
    
    console.log(`🚫 UNIVERSAL FIX: Cleared Lightning Round for ALL ${totalCleared} agents:`, agentEmails);
  }

  // UNIVERSAL FIX: Get all agents currently in Lightning Round (for debugging)
  static getAllLightningRoundAgents(): string[] {
    return Array.from(this.progressMap.keys()).filter(email => 
      this.progressMap.get(email)?.lightningRoundActive
    );
  }

  // Auto-assign pending hotleads to Lightning Round agent
  static async autoAssignHotleadsForLightningRound(agentEmail: string, maxLeads: number = 20): Promise<number> {
    try {
      console.log(`🎯 AUTO-ASSIGN: Lightning Round rewards for ${agentEmail} - checking current hotlead count`);
      
      if (!supabase) {
        console.error('❌ Supabase client not available for autoAssignHotleadsForLightningRound');
        return 0;
      }

      // Check current assigned hotleads count
      const { data: existingHotleads, error: checkError } = await supabase
        .from('hotlead')
        .select('id')
        .eq('cn_email', agentEmail)
        .eq('cnresolution', 'assigned');
        
      if (checkError) {
        console.error(`❌ AUTO-ASSIGN: Error checking existing hotleads for ${agentEmail}:`, checkError);
        return 0;
      }
      
      const currentCount = existingHotleads?.length || 0;
      const MAX_TOTAL_HOTLEADS = 50;
      const LIGHTNING_ROUND_REWARD = 20;
      
      if (currentCount >= MAX_TOTAL_HOTLEADS) {
        console.log(`🚫 AUTO-ASSIGN: ${agentEmail} already has ${currentCount} hotleads (max ${MAX_TOTAL_HOTLEADS}) - no new assignments`);
        return currentCount;
      }
      
      // Calculate how many more they can get (up to 20, but not exceeding 50 total)
      const availableSlots = MAX_TOTAL_HOTLEADS - currentCount;
      const leadsToAssign = Math.min(LIGHTNING_ROUND_REWARD, availableSlots);
      
      console.log(`🏆 LIGHTNING REWARDS: ${agentEmail} has ${currentCount}/50 hotleads - assigning ${leadsToAssign} more`);
      
      if (leadsToAssign <= 0) {
        console.log(`✅ AUTO-ASSIGN: ${agentEmail} already at capacity with ${currentCount} hotleads`);
        return currentCount;
      }
      
      // Get available pending hotleads with COMPLETE DATA AND taalk_lead_id (real hotleads only)
      const { data: availableHotleads, error: fetchError } = await supabase
        .from('hotlead')
        .select('id, first_name, last_name, phone, taalk_state')
        .eq('cnresolution', 'pending')
        .neq('cnresolution', 'AOresolve')
        .is('cn_email', null)
        .not('first_name', 'is', null)
        .not('last_name', 'is', null)
        .neq('first_name', '')
        .neq('last_name', '')
        .not('taalk_lead_id', 'is', null)
        .neq('taalk_lead_id', '')
        .limit(leadsToAssign);
        
      if (fetchError) {
        console.error(`❌ AUTO-ASSIGN: Error fetching available hotleads:`, fetchError);
        return 0;
      }
      
      if (!availableHotleads || availableHotleads.length === 0) {
        console.log(`📭 AUTO-ASSIGN: No available hotleads in pending pool for Lightning Round rewards`);
        return currentCount; // Return current count, not 0
      }
      
      // Assign the hotleads to the agent
      const hotleadIds = availableHotleads.map(lead => lead.id);
      const { error: assignError } = await supabase
        .from('hotlead')
        .update({
          cn_email: agentEmail,
          cnresolution: 'assigned',
          assigned_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .in('id', hotleadIds);
        
      if (assignError) {
        console.error(`❌ AUTO-ASSIGN: Error assigning hotleads to ${agentEmail}:`, assignError);
        return 0;
      }
      
      const newTotal = currentCount + availableHotleads.length;
      console.log(`⚡ LIGHTNING SUCCESS: ${agentEmail} now has ${newTotal}/50 total hotleads (+${availableHotleads.length} new rewards)`);
      console.log(`🔥 NEW LIGHTNING REWARDS:`, availableHotleads.map(lead => `${lead.first_name} ${lead.last_name} (${lead.phone})`));
      
      return newTotal;
      
    } catch (error) {
      console.error(`❌ AUTO-ASSIGN: Unexpected error assigning hotleads to ${agentEmail}:`, error);
      return 0;
    }
  }

  // UNIVERSAL SYSTEM: Auto-activate Lightning Round when agent reaches 12+ daily calls
  static async checkAndAutoActivateLightningRound(agentEmail: string): Promise<boolean> {
    // Skip system accounts
    if (agentEmail === 'cnsysop@aoglobelife.com') {
      return false;
    }

    // Check if already in Lightning Round
    const currentProgress = this.progressMap.get(agentEmail);
    if (currentProgress?.lightningRoundActive) {
      return true; // Already active
    }

    try {
      // Count today's calls
      const dailyCallCount = await this.getTodayCallCount(agentEmail);
      
      // Auto-activate if 25+ calls
      if (dailyCallCount >= 25) {
        console.log(`🎯 UNIVERSAL SYSTEM: Auto-activating Lightning Round for ${agentEmail} - ${dailyCallCount} calls today!`);
        
        // Auto-assign hotleads from pending pool as Lightning Round rewards
        const assignedCount = await this.autoAssignHotleadsForLightningRound(agentEmail, 25);
        console.log(`🏆 LIGHTNING ROUND REWARDS: Assigned ${assignedCount} hotleads to ${agentEmail} as milestone rewards`);
        
        await this.startLightningRound(agentEmail, 25);
        return true;
      } else {
        console.log(`📊 UNIVERSAL SYSTEM: ${agentEmail} has ${dailyCallCount} calls today (need 25+ for Lightning Round)`);
        return false;
      }
      
    } catch (error) {
      console.error(`❌ UNIVERSAL SYSTEM: Error checking calls for ${agentEmail}:`, error);
      return false;
    }
  }
}