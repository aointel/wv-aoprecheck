/**
 * Live Call Board Stats Scheduler
 * 
 * Automatically updates live_call_boardt stats from agent_dial_metrics
 * Runs every 30 seconds for LIVE real-time updates
 */

import * as cron from 'node-cron';
import { supabaseAdmin } from './supabase';
import { rebuildAllLiveSnapshots } from './public-live-card-service';

class LiveCallBoardStatsScheduler {
  private cronJob: cron.ScheduledTask | null = null;
  private midnightResetJob: cron.ScheduledTask | null = null;
  private liveUpdateInterval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private lastRunTime: Date | null = null;
  private lastProcessedDate: string | null = null; // Track last PST date processed
  private lastResetDate: string | null = null; // Track last PST date we reset stats
  private recruitRpcFailed = false; // suppress repeated RPC errors once function is known-missing

  /**
   * Start the scheduler
   */
  start(): void {
    if (!supabaseAdmin) {
      console.warn('⚠️ Live Call Board Stats Scheduler disabled - Supabase admin client not configured');
      return;
    }

    if (this.cronJob) {
      console.log('⚠️ Live Call Board Stats Scheduler already running');
      return;
    }

    console.log('🔄 Starting Live Call Board Stats Scheduler...');

    // Run immediately on startup
    this.updateStats().catch(error => {
      console.error('❌ Initial live call board stats update failed:', error);
    });

    // Schedule to run every 30 seconds for LIVE updates
    // This is a LIVE call board - needs frequent updates
    // Cron format: minute hour day month weekday
    // '*/1 * * * *' = every 1 minute (minimum cron granularity)
    // For sub-minute, we use setInterval instead
    this.cronJob = cron.schedule('*/1 * * * *', async () => {
      if (!this.isRunning) {
        await this.updateStats();
      } else {
        console.log('⏳ Live call board stats update skipped - previous update still running');
      }
    });
    
    // ALSO run every 30 seconds using setInterval for true live updates
    this.liveUpdateInterval = setInterval(async () => {
      if (!this.isRunning) {
        await this.updateStats();
      }
    }, 30000); // 30 seconds

    // Schedule midnight PST reset
    // Run every minute between 7:00-8:00 UTC to catch midnight PST/PDT
    // 12:00 AM PST = 8:00 AM UTC (standard time)
    // 12:00 AM PDT = 7:00 AM UTC (daylight saving time)
    // Check every minute to ensure we catch it exactly
    this.midnightResetJob = cron.schedule('* 7,8 * * *', async () => {
      // Verify it's actually midnight PST before resetting
      const now = new Date();
      const pstTime = now.toLocaleString('en-US', { 
        timeZone: 'America/Los_Angeles', 
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      const pstDate = now.toLocaleString('en-US', {
        timeZone: 'America/Los_Angeles',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).replace(/(\d+)\/(\d+)\/(\d+)/, '$3-$1-$2');
      const [pstHour, pstMinute] = pstTime.split(':').map(Number);
      
      // Only reset if it's exactly midnight (00:00) PST and we haven't reset today
      if (pstHour === 0 && pstMinute === 0 && this.lastResetDate !== pstDate) {
        console.log('🔄 Midnight PST reset: Resetting all outbound and recruit stats to 0...');
        console.log(`   Current PST time: ${pstTime}`);
        console.log(`   Current PST date: ${pstDate}`);
        this.lastResetDate = pstDate;
        await this.resetAllStats();
      }
    });

    console.log('✅ Live Call Board Stats Scheduler started');
    console.log('   📊 Update frequency: Every 30 seconds (setInterval) + Every 1 minute (cron)');
    console.log('   📊 DIALED: Counting from twilio_call_logs (calls with duration > 0)');
    console.log('   📊 REACHED: Counting from twilio_call_logs (calls with duration >= 50s)');
    console.log('   📊 INSTANT_PRESENTATION: Counting from agent_dial_metrics (event_type = instant_presentation)');
    console.log('   📊 BOOKED: Counting from agent_dial_metrics ONLY');
    console.log('   🔄 Midnight PST reset scheduled - will reset stats at 12:00 AM PST (8:00 AM UTC)');
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }
    if (this.midnightResetJob) {
      this.midnightResetJob.stop();
      this.midnightResetJob = null;
    }
    if (this.liveUpdateInterval) {
      clearInterval(this.liveUpdateInterval);
      this.liveUpdateInterval = null;
    }
    console.log('🛑 Live Call Board Stats Scheduler stopped');
  }

  /**
   * Reset all stats and recalculate from scratch (called at midnight PST)
   * This recalculates today's stats from agent_dial_metrics and twilio_call_logs
   */
  private async resetAllStats(): Promise<void> {
    try {
      if (!supabaseAdmin) {
        console.error('❌ Cannot reset stats - Supabase admin client not configured');
        return;
      }

      const resetTime = new Date().toLocaleString('en-US', { 
        timeZone: 'America/Los_Angeles',
        dateStyle: 'full',
        timeStyle: 'long'
      });
      console.log(`🔄 Midnight PST reset: Recalculating all stats from scratch for new day...`);
      console.log(`   Reset time: ${resetTime} PST`);

      // First, reset all stats to 0 (clean slate for new day)
      const { error: resetError } = await supabaseAdmin!
        .from('live_call_boardt')
        .update({
          today_dialed: 0,
          today_reached: 0,
          today_booked: 0,
          today_instant_presentation: 0,
          today_presentations: 0,
          today_sales: 0,
          updated_at: new Date().toISOString()
        })
        .neq('agent_email', '');

      if (resetError) {
        console.error('❌ Failed to reset outbound stats at midnight:', resetError);
        return;
      }

      // Reset recruit stats to 0
      const { error: recruitResetError } = await supabaseAdmin!
        .from('live_call_boardt_recruit')
        .update({
          today_dialed: 0,
          today_reached: 0,
          today_booked: 0,
          today_connects: 0,
          updated_at: new Date().toISOString()
        })
        .neq('agent_email', '');

      if (recruitResetError) {
        console.error('❌ Failed to reset recruit stats at midnight:', recruitResetError);
      }

      console.log('✅ All stats reset to 0 for new day');
      
      // Reset the last processed date so next update recalculates from scratch
      this.lastProcessedDate = null;
      
      // Immediately recalculate stats from scratch for the new day
      console.log('🔄 Recalculating stats from agent_dial_metrics and twilio_call_logs for new day...');
      await this.updateStats();
      
      console.log('✅ Midnight reset complete - stats recalculated for new day');
    } catch (error) {
      console.error('❌ Error resetting stats at midnight:', error);
    }
  }

  /**
   * Manually trigger an update (can be called from API or other services)
   */
  async triggerUpdate(): Promise<void> {
    if (this.isRunning) {
      console.log('⏳ Live call board stats update already in progress, skipping manual trigger');
      return;
    }
    await this.updateStats();
  }

  /**
   * Manually trigger a reset (for testing midnight reset)
   */
  async triggerReset(): Promise<void> {
    console.log('🔄 Manual reset triggered - resetting all outbound and recruit stats to 0...');
    await this.resetAllStats();
  }

  /**
   * Update live call board stats from agent_dial_metrics
   * CRITICAL: Now uses SQL function which has correct logic (call_status='completed' for reached)
   * and GREATEST protection to prevent resets
   */
  private async updateStats(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      console.log('🔄 Updating live call board stats via SQL function...');
      console.log('📊 DIALED: Counting from twilio_call_logs (calls with duration >= 1s OR answered)');
      console.log('📊 REACHED: Counting from agent_dial_metrics (event_type = reach)');
      console.log('📊 INSTANT_PRESENTATION: Counting from agent_dial_metrics (event_type = instant_presentation)');
      console.log('📊 BOOKED: Counting from agent_dial_metrics (event_type = booked)');

      // CRITICAL: Use the SQL function instead of recalculating in TypeScript
      // The SQL function has:
      // 1. DIALED: Counted from twilio_call_logs (distinct to_number with duration >= 1s OR answered)
      // 2. REACHED: Counted from agent_dial_metrics (event_type = 'reach', DISTINCT lead_phone)
      // 3. INSTANT_PRESENTATION: Counted from agent_dial_metrics (event_type = 'instant_presentation', DISTINCT lead_phone)
      // 4. BOOKED: Counted from agent_dial_metrics (event_type = 'booked', DISTINCT lead_phone)
      // EST timezone handling
      // DISTINCT filtering to prevent duplicates
      const { error: rpcError, data: rpcData } = await supabaseAdmin!
        .rpc('update_live_call_boardt_stats_from_metrics');

      if (rpcError) {
        throw new Error(`SQL function failed: ${rpcError.message}`);
      }

      // Log success with details
      if (rpcData !== null) {
        console.log('✅ SQL function executed successfully');
      }

      // Also update recruit stats (skip if RPC functions are known-missing to avoid log spam)
      if (!this.recruitRpcFailed) {
        console.log('🔄 Updating recruit stats...');
        const { error: recruitRpcError } = await supabaseAdmin!
          .rpc('update_live_call_boardt_recruit_stats_all');

        if (recruitRpcError) {
          console.error('❌ Recruit stats update failed (will suppress further errors until restart):', recruitRpcError);
          this.recruitRpcFailed = true;
        } else {
          console.log('✅ Recruit stats updated');
          // Update recruit connects only if stats worked
          const { error: connectsRpcError } = await supabaseAdmin!
            .rpc('update_live_call_boardt_recruit_connects');

          if (connectsRpcError) {
            console.error('❌ Recruit connects update failed (will suppress further errors until restart):', connectsRpcError);
            this.recruitRpcFailed = true;
          } else {
            console.log('✅ Recruit connects updated');
          }
        }
      }

      // Verify the update worked by checking a sample of updated records
      const { data: sampleData, error: sampleError } = await supabaseAdmin!
        .from('live_call_boardt')
        .select('agent_email, today_dialed, today_reached, today_booked, updated_at')
        .order('updated_at', { ascending: false })
        .limit(5);

      if (!sampleError && sampleData && sampleData.length > 0) {
        console.log(`✅ Verified: ${sampleData.length} sample records updated`);
        const latestUpdate = sampleData[0];
        console.log(`   Latest: ${latestUpdate.agent_email} - Dialed: ${latestUpdate.today_dialed}, Reached: ${latestUpdate.today_reached}, Booked: ${latestUpdate.today_booked}`);
      }

      const duration = Date.now() - startTime;
      this.lastRunTime = new Date();
      await rebuildAllLiveSnapshots();
      console.log(`✅ Live call board stats updated via SQL function in ${duration}ms`);
      console.log(`   📊 DIALED/REACHED: From twilio_call_logs | INSTANT_PRESENTATION: From masterlead | BOOKED: From agent_dial_metrics`);

    } catch (error) {
      console.error('❌ Error updating live call board stats:', error);
      this.lastRunTime = new Date();
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Count distinct phone numbers for an agent by event type
   * @deprecated No longer used - SQL function handles all calculations
   */
  private countDistinctPhones(
    metrics: Array<{ event_type: string; lead_phone: string }>,
    eventType: string
  ): number {
    const phones = new Set<string>();
    for (const metric of metrics) {
      if (metric.event_type === eventType && metric.lead_phone) {
        phones.add(metric.lead_phone);
      }
    }
    return phones.size;
  }

  /**
   * Get today's EST date range (no longer used - SQL function handles timezone)
   * @deprecated Use SQL function get_today_est_range() instead
   */
  private async getTodayPSTRange(): Promise<{ todayStart: string; todayEnd: string; todayDate: string }> {
    const now = new Date();
    
    // Get current PST date components
    const pstYear = parseInt(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric' }));
    const pstMonth = parseInt(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles', month: '2-digit' }));
    const pstDay = parseInt(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles', day: '2-digit' }));
    
    // Create date string for tracking (YYYY-MM-DD)
    const todayDate = `${pstYear}-${String(pstMonth).padStart(2, '0')}-${String(pstDay).padStart(2, '0')}`;
    
    // Create a date string for midnight PST today
    const pstMidnightString = `${pstYear}-${String(pstMonth).padStart(2, '0')}-${String(pstDay).padStart(2, '0')}T00:00:00`;
    
    // Try PST first (UTC-8)
    let utcTodayStart = new Date(`${pstMidnightString}-08:00`);
    
    // Verify: check what PST date this UTC time represents
    const verifyPST = utcTodayStart.toLocaleString('en-US', { 
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const verifyDate = verifyPST.replace(/(\d+)\/(\d+)\/(\d+)/, '$3-$1-$2');
    const expectedDate = `${pstYear}-${String(pstMonth).padStart(2, '0')}-${String(pstDay).padStart(2, '0')}`;
    
    // If dates don't match, it's probably DST (PDT is UTC-7)
    if (verifyDate !== expectedDate) {
      utcTodayStart = new Date(`${pstMidnightString}-07:00`);
    }
    
    const utcTodayEnd = new Date(utcTodayStart.getTime() + (24 * 60 * 60 * 1000));
    
    return {
      todayStart: utcTodayStart.toISOString(),
      todayEnd: utcTodayEnd.toISOString(),
      todayDate
    };
  }

  /**
   * Get scheduler status
   */
  getStatus(): { isRunning: boolean; lastRunTime: Date | null; cronJobActive: boolean; midnightResetActive: boolean } {
    return {
      isRunning: this.isRunning,
      lastRunTime: this.lastRunTime,
      cronJobActive: this.cronJob !== null,
      midnightResetActive: this.midnightResetJob !== null
    };
  }
}

// Export singleton instance
export const liveCallBoardStatsScheduler = new LiveCallBoardStatsScheduler();

