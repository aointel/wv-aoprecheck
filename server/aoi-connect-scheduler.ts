import cron from 'node-cron';
import { AOIConnectSync } from './aoi-connect-sync';

export class AOIConnectScheduler {
  private static instance: AOIConnectScheduler;
  private isRunning = false;
  private cronJob: cron.ScheduledTask | null = null;
  private stats = {
    totalSynced: 0,
    totalErrors: 0,
    lastRunTime: null as Date | null,
    isScheduledRunning: false
  };

  static getInstance(): AOIConnectScheduler {
    if (!AOIConnectScheduler.instance) {
      AOIConnectScheduler.instance = new AOIConnectScheduler();
    }
    return AOIConnectScheduler.instance;
  }

  /**
   * Start the AOI Connect sync scheduler
   * Runs every 2 minutes to detect new connects and send notifications
   */
  start(): void {
    if (this.isRunning) {
      console.log('🔄 AOI Connect scheduler already running');
      return;
    }

    // Schedule to run every 2 minutes
    this.cronJob = cron.schedule('*/2 * * * *', async () => {
      await this.runSyncProcess();
    }, {
      scheduled: true,
      timezone: 'America/New_York'
    });

    this.isRunning = true;
    console.log('✅ AOI Connect scheduler started - syncing every 2 minutes');

    // Run initial sync immediately
    setTimeout(() => {
      this.runSyncProcess();
    }, 5000); // Wait 5 seconds after startup
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
    console.log('🛑 AOI Connect scheduler stopped');
  }

  /**
   * Run the sync process and update stats
   */
  private async runSyncProcess(): Promise<void> {
    if (this.stats.isScheduledRunning) {
      console.log('⏳ AOI Connect sync already in progress, skipping...');
      return;
    }

    try {
      this.stats.isScheduledRunning = true;
      this.stats.lastRunTime = new Date();
      
      console.log('🔄 AOI Connect scheduled sync starting...');
      const result = await AOIConnectSync.syncFromSupabase();
      
      this.stats.totalSynced += result.synced;
      this.stats.totalErrors += result.errors;

      if (result.synced > 0) {
        console.log(`✅ AOI Connect sync: ${result.synced} new connects processed, ${result.errors} errors`);
      } else {
        console.log(`✅ AOI Connect sync: No new connects found`);
      }

      console.log(`📊 AOI CONNECT TOTALS: ${this.stats.totalSynced} synced, ${this.stats.totalErrors} errors since startup`);

    } catch (error) {
      console.error('❌ AOI Connect scheduled sync failed:', error);
      this.stats.totalErrors++;
    } finally {
      this.stats.isScheduledRunning = false;
    }
  }

  /**
   * Get scheduler status and statistics
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      isScheduledRunning: this.stats.isScheduledRunning,
      totalSynced: this.stats.totalSynced,
      totalErrors: this.stats.totalErrors,
      lastRunTime: this.stats.lastRunTime,
      nextRun: this.cronJob ? 'Every 2 minutes' : null
    };
  }

  /**
   * Manually trigger a sync (for testing/debugging)
   */
  async triggerManualSync(): Promise<{ synced: number; errors: number }> {
    console.log('🔧 Manual AOI Connect sync triggered');
    const result = await AOIConnectSync.syncFromSupabase();
    this.stats.totalSynced += result.synced;
    this.stats.totalErrors += result.errors;
    return result;
  }
}

// Export singleton instance
export const aoiConnectScheduler = AOIConnectScheduler.getInstance();