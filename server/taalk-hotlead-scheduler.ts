// Taalk Hotlead Scheduler - Runs every 15 minutes to convert Taalk calls to hotleads
import * as cron from 'node-cron';
import { taalkHotleadService } from './taalk-hotlead-service';

class TaalkHotleadScheduler {
  private isRunning: boolean = false;
  private cronJob: cron.ScheduledTask | null = null;
  private lastRunTime: Date | null = null;
  private totalProcessed: number = 0;
  private totalConverted: number = 0;

  constructor() {
    this.initializeScheduler();
  }

  /**
   * Initialize the 15-minute cron scheduler
   */
  private initializeScheduler() {
    // Run every 15 minutes: '0 */15 * * * *'
    // For testing, you can use '*/1 * * * *' (every minute)
    this.cronJob = cron.schedule('0 */15 * * * *', async () => {
      await this.runTaalkHotleadProcess();
    }, {
      scheduled: false, // Don't start immediately
      timezone: "America/New_York"
    });

    console.log('⏰ TAALK HOTLEAD SCHEDULER: Initialized (15-minute intervals)');
  }

  /**
   * Start the automated scheduler
   */
  start() {
    if (this.cronJob && !this.isRunning) {
      this.cronJob.start();
      this.isRunning = true;
      console.log('🚀 TAALK HOTLEAD SCHEDULER: Started - Running every 15 minutes');
      
      // Run once immediately for testing
      setTimeout(() => this.runTaalkHotleadProcess(), 5000);
    } else {
      console.log('⚠️ TAALK HOTLEAD SCHEDULER: Already running or not initialized');
    }
  }

  /**
   * Stop the automated scheduler
   */
  stop() {
    if (this.cronJob && this.isRunning) {
      this.cronJob.stop();
      this.isRunning = false;
      console.log('⏹️ TAALK HOTLEAD SCHEDULER: Stopped');
    }
  }

  /**
   * Run the Taalk to hotlead conversion process
   */
  private async runTaalkHotleadProcess() {
    if (this.isRunning && this.lastRunTime && (Date.now() - this.lastRunTime.getTime()) < 60000) {
      console.log('⏭️ TAALK PROCESS: Skipping run (already ran within last minute)');
      return;
    }

    console.log('🔄 TAALK HOTLEAD SCHEDULER: Starting 15-minute conversion process');
    this.lastRunTime = new Date();

    try {
      const result = await taalkHotleadService.processTaalkToHotleads();
      
      this.totalProcessed += result.processed;
      this.totalConverted += result.converted;

      console.log(`✅ TAALK SCHEDULER COMPLETE: Processed ${result.processed}, Converted ${result.converted}`);
      console.log(`📊 TAALK TOTALS: ${this.totalProcessed} processed, ${this.totalConverted} converted since startup`);

      // Log significant conversions
      if (result.converted > 0) {
        console.log(`🔥 HOTLEAD ALERT: ${result.converted} new hotleads created from Taalk calls!`);
      }

    } catch (error) {
      console.error('❌ TAALK SCHEDULER ERROR:', error);
    }
  }

  /**
   * Manually trigger the process (for testing/API endpoints)
   */
  async runManual(): Promise<{ processed: number, converted: number }> {
    console.log('🔄 TAALK MANUAL TRIGGER: Running conversion process manually');
    return await taalkHotleadService.processTaalkToHotleads();
  }

  /**
   * Get scheduler status and statistics
   */
  getStatus() {
    let nextRunTime = null;
    try {
      if (this.cronJob && typeof this.cronJob.nextDates === 'function') {
        const nextDates = this.cronJob.nextDates(1);
        nextRunTime = nextDates && nextDates.length > 0 ? nextDates[0] : null;
      }
    } catch (error) {
      console.log('🔍 Next run time not available');
    }

    return {
      isRunning: this.isRunning,
      lastRunTime: this.lastRunTime,
      totalProcessed: this.totalProcessed,
      totalConverted: this.totalConverted,
      nextRunTime,
      schedule: '15 minutes',
      service: taalkHotleadService.getStats()
    };
  }

  /**
   * Update the schedule (for configuration changes)
   */
  updateSchedule(cronExpression: string) {
    if (this.cronJob) {
      this.cronJob.destroy();
    }

    this.cronJob = cron.schedule(cronExpression, async () => {
      await this.runTaalkHotleadProcess();
    }, {
      scheduled: this.isRunning,
      timezone: "America/New_York"
    });

    console.log(`⏰ TAALK SCHEDULER: Updated to new schedule: ${cronExpression}`);
  }
}

// Export singleton instance
export const taalkHotleadScheduler = new TaalkHotleadScheduler();

// Auto-start disabled - scheduler stopped
// taalkHotleadScheduler.start();