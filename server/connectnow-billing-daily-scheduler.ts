/**
 * ConnectNow Billing Daily Scheduler
 * 
 * Populates billing data (Pre-Check and Call Connector Pro) into connectnow_daily_kpis table
 * Runs daily at 12:00 AM PST (midnight)
 * 
 * This ensures billing data is always up-to-date for the ConnectNow Analytics dashboard
 */

import * as cron from 'node-cron';
import { supabaseAdmin } from './supabase';
import { format, parse } from 'date-fns';

export class ConnectNowBillingDailyScheduler {
  private cronJob: cron.ScheduledTask | null = null;
  private isRunning = false;

  /**
   * Start the daily billing data population scheduler
   */
  start(): void {
    if (this.isRunning) {
      console.log('⚠️ ConnectNow Billing Daily Scheduler already running');
      return;
    }

    console.log('💰 Starting ConnectNow Billing Daily Scheduler...');
    
    // Schedule daily population at 12:00 AM PST (midnight)
    // Cron format: minute hour day month weekday
    // '0 0 * * *' = every day at midnight
    this.cronJob = cron.schedule('0 0 * * *', async () => {
      console.log('⏰ Daily billing data population trigger - 12:00 AM PST');
      await this.populateBillingData();
    }, {
      scheduled: true,
      timezone: "America/Los_Angeles" // PST timezone
    });

    this.isRunning = true;
    console.log('✅ ConnectNow Billing Daily Scheduler started - will populate data daily at 12:00 AM PST');
    
    // Optionally run immediately on startup to catch up if server was down
    // Uncomment if you want to populate today's data on server restart
    // setTimeout(() => {
    //   this.populateBillingData().catch(err => {
    //     console.error('❌ Initial billing data population failed:', err);
    //   });
    // }, 10000); // Wait 10 seconds after startup
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }
    this.isRunning = false;
    console.log('🛑 ConnectNow Billing Daily Scheduler stopped');
  }

  /**
   * Populate billing data for yesterday (the day that just ended)
   * This runs at midnight, so we populate data for the day that just completed
   */
  private async populateBillingData(): Promise<void> {
    try {
      // Get yesterday's date in PST (since we're running at midnight PST)
      const now = new Date();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      
      const dateStr = format(yesterday, 'yyyy-MM-dd');
      console.log(`📅 Populating billing data for ${dateStr}...`);

      // Calculate date range for the day (start and end of day in PST)
      const dateStart = `${dateStr}T00:00:00`;
      const dateEnd = `${dateStr}T23:59:59`;

      // Fetch Pre-Check billed (sessions with Taalk call URL created during the day)
      const { count: precheckBilled, error: precheckError } = await supabaseAdmin
        .from('verification_sessions')
        .select('*', { count: 'exact', head: true })
        .not('taalk_call_url', 'is', null)
        .gte('created_at', dateStart)
        .lte('created_at', dateEnd);

      if (precheckError) {
        console.error(`❌ Error fetching Pre-Check billed for ${dateStr}:`, precheckError);
      }

      // Fetch Pre-Check sign-ups (sessions created during the day)
      const { count: precheckSignUps, error: precheckSignUpsError } = await supabaseAdmin
        .from('verification_sessions')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', dateStart)
        .lte('created_at', dateEnd);

      if (precheckSignUpsError) {
        console.error(`❌ Error fetching Pre-Check sign-ups for ${dateStr}:`, precheckSignUpsError);
      }

      // Fetch Call Connector Pro active accounts (active/trialing professional/elite subscriptions)
      const { data: ccpSubscriptions, error: ccpError } = await supabaseAdmin
        .from('connectnow_subscriptions')
        .select('user_email, created_at')
        .in('status', ['active', 'trialing'])
        .in('plan', ['professional', 'elite']);

      let ccpActiveAccounts = 0;
      if (ccpSubscriptions) {
        const dateEndObj = new Date(dateEnd);
        const activeAccounts = new Set<string>();
        for (const sub of ccpSubscriptions) {
          const createdAt = sub.created_at ? new Date(sub.created_at) : new Date();
          // Count all active subscriptions that existed before or during the day
          if (createdAt <= dateEndObj) {
            activeAccounts.add(sub.user_email);
          }
        }
        ccpActiveAccounts = activeAccounts.size;
      }

      if (ccpError) {
        console.error(`❌ Error fetching Call Connector Pro subscriptions for ${dateStr}:`, ccpError);
      }

      // Fetch Call Connector Pro sign-ups (trials started during the day OR subscriptions created during the day)
      const { data: ccpSignUpsData, error: ccpSignUpsError } = await supabaseAdmin
        .from('connectnow_subscriptions')
        .select('trial_started_at, created_at, plan')
        .in('plan', ['professional', 'elite']);

      let ccpSignUps = 0;
      if (ccpSignUpsData) {
        const dateStartObj = new Date(dateStart);
        const dateEndObj = new Date(dateEnd);
        
        for (const sub of ccpSignUpsData) {
          // Use trial_started_at if available, otherwise use created_at
          const signupDate = sub.trial_started_at 
            ? new Date(sub.trial_started_at)
            : (sub.created_at ? new Date(sub.created_at) : null);
          
          if (signupDate && signupDate >= dateStartObj && signupDate <= dateEndObj) {
            ccpSignUps++;
          }
        }
      }

      if (ccpSignUpsError) {
        console.error(`❌ Error fetching Call Connector Pro sign-ups for ${dateStr}:`, ccpSignUpsError);
      }

      const billingData = {
        precheck_billed: precheckBilled || 0,
        precheck_sign_ups: precheckSignUps || 0,
        call_connector_pro_active_accounts: ccpActiveAccounts,
        call_connector_pro_sign_ups: ccpSignUps || 0,
      };

      console.log(`📊 Billing data for ${dateStr}:`, billingData);

      // Update all campaign rows for this date with the billing data
      const { error: updateError } = await supabaseAdmin
        .from('connectnow_daily_kpis')
        .update({
          precheck_billed: billingData.precheck_billed,
          precheck_sign_ups: billingData.precheck_sign_ups,
          call_connector_pro_active_accounts: billingData.call_connector_pro_active_accounts,
          call_connector_pro_sign_ups: billingData.call_connector_pro_sign_ups,
        })
        .eq('date', dateStr);

      if (updateError) {
        console.error(`❌ Error updating billing data for ${dateStr}:`, updateError);
        throw updateError;
      }

      // Check how many rows were updated
      const { count: updatedCount } = await supabaseAdmin
        .from('connectnow_daily_kpis')
        .select('*', { count: 'exact', head: true })
        .eq('date', dateStr);

      console.log(`✅ Updated billing data for ${dateStr} (${updatedCount || 0} campaign rows)`);
      console.log(`✅ Daily billing data population complete for ${dateStr}`);

    } catch (error) {
      console.error('❌ Error in daily billing data population:', error);
    }
  }
}

// Export singleton instance
export const connectNowBillingDailyScheduler = new ConnectNowBillingDailyScheduler();

