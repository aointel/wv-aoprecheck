import * as cron from 'node-cron';
import { supabaseAdmin } from './supabase';

/**
 * CCPRO Flag Sync Scheduler
 * 
 * Syncs ccpro_enabled flag in agent_live_call_status table from Stripe subscriptions
 * Runs ONCE DAILY at 3:00 AM EST
 * 
 * Source of truth: connectnow_subscriptions table (synced from Stripe)
 * Target: agent_live_call_status.ccpro_enabled
 */
export class CCProFlagSyncScheduler {
  private cronJob: cron.ScheduledTask | null = null;
  private isRunning = false;

  start(): void {
    if (this.isRunning) {
      console.log('⚠️ CCPRO flag sync scheduler already running');
      return;
    }

    console.log('🔄 Starting CCPRO flag sync scheduler...');
    
    // Schedule daily sync at 3:00 AM EST
    this.cronJob = cron.schedule('0 3 * * *', async () => {
      console.log('⏰ Daily CCPRO flag sync trigger - 3:00 AM EST');
      await this.syncCCProFlags();
    }, {
      scheduled: true,
      timezone: "America/New_York"
    });

    // Also run immediately on startup to sync current state
    console.log('🔄 Running initial CCPRO flag sync...');
    this.syncCCProFlags().catch(err => {
      console.error('❌ Initial CCPRO flag sync failed:', err);
    });

    this.isRunning = true;
    console.log('✅ CCPRO flag sync scheduler started - will sync daily at 3:00 AM EST');
  }

  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }
    this.isRunning = false;
    console.log('🛑 CCPRO flag sync scheduler stopped');
  }

  /**
   * Sync CCPRO flags from Stripe subscriptions to agent_live_call_status
   * ONLY checks connectnow_subscriptions table (source of truth from Stripe)
   */
  private async syncCCProFlags(): Promise<void> {
    try {
      console.log('🔄 Starting CCPRO flag sync from Stripe subscriptions...');

      if (!supabaseAdmin) {
        throw new Error('Supabase admin client not available');
      }

      // Get all agents with professional/elite active/trialing subscriptions (CCPRO enabled)
      const { data: ccproSubscriptions, error: subError } = await supabaseAdmin
        .from('connectnow_subscriptions')
        .select('user_email, plan, status')
        .or('status.eq.active,status.eq.trialing')
        .in('plan', ['professional', 'elite']);

      if (subError) {
        throw subError;
      }

      // Create Set of emails with CCPRO enabled
      const ccproEnabledEmails = new Set(
        (ccproSubscriptions || []).map(s => s.user_email.toLowerCase().trim())
      );

      console.log(`📊 Found ${ccproEnabledEmails.size} agents with CCPRO subscriptions`);

      // Get all agents in agent_live_call_status
      const { data: allAgents, error: agentsError } = await supabaseAdmin
        .from('agent_live_call_status')
        .select('agent_email');

      if (agentsError) {
        throw agentsError;
      }

      if (!allAgents || allAgents.length === 0) {
        console.log('⚠️ No agents found in agent_live_call_status - skipping sync');
        return;
      }

      let updated = 0;
      let errors = 0;

      // Update each agent's ccpro_enabled flag based on Stripe subscription
      for (const agent of allAgents) {
        const agentEmail = agent.agent_email.toLowerCase().trim();
        const ccproEnabled = ccproEnabledEmails.has(agentEmail);
        
        const { error: updateError } = await supabaseAdmin
          .from('agent_live_call_status')
          .update({ ccpro_enabled: ccproEnabled })
          .eq('agent_email', agentEmail);

        if (updateError) {
          console.error(`❌ Failed to update ${agentEmail}:`, updateError);
          errors++;
        } else {
          updated++;
        }
      }

      console.log(`✅ CCPRO flag sync completed:`);
      console.log(`   - Updated: ${updated} agents`);
      console.log(`   - Errors: ${errors}`);
      console.log(`   - CCPRO Enabled: ${ccproEnabledEmails.size} agents`);
      
    } catch (error) {
      console.error('❌ Error syncing CCPRO flags:', error);
      throw error;
    }
  }

  /**
   * Manual sync function - can be called via API endpoint
   */
  async manualSync(): Promise<{ success: boolean; updated: number; errors: number; ccproEnabled: number }> {
    try {
      await this.syncCCProFlags();
      
      // Get counts for response
      const { data: ccproSubscriptions } = await supabaseAdmin
        ?.from('connectnow_subscriptions')
        .select('user_email')
        .or('status.eq.active,status.eq.trialing')
        .in('plan', ['professional', 'elite']) || { data: [] };

      const { data: allAgents } = await supabaseAdmin
        ?.from('agent_live_call_status')
        .select('agent_email') || { data: [] };

      return {
        success: true,
        updated: allAgents?.length || 0,
        errors: 0,
        ccproEnabled: ccproSubscriptions?.length || 0
      };
    } catch (error) {
      console.error('❌ Manual CCPRO sync failed:', error);
      return {
        success: false,
        updated: 0,
        errors: 1,
        ccproEnabled: 0
      };
    }
  }
}

// Singleton instance
export const ccproFlagSyncScheduler = new CCProFlagSyncScheduler();

