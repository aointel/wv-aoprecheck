import cron from 'node-cron';
import { MissedCallNotificationService } from './missed-call-notification-service';

export class NotificationScheduler {
  private static isRunning = false;
  private static cronJob: cron.ScheduledTask | null = null;

  /**
   * Start the 15-minute notification processing scheduler
   */
  static start(): void {
    if (this.isRunning) {
      console.log('⚠️ Notification scheduler is already running');
      return;
    }

    console.log('🚀 Starting missed call notification scheduler (15-minute intervals)...');

    // Run every 15 minutes: */15 * * * *
    // For testing, you can use */1 * * * * for every minute
    this.cronJob = cron.schedule('*/15 * * * *', async () => {
      await this.runNotificationProcess();
    }, {
      scheduled: true,
      timezone: "America/New_York" // Adjust to your preferred timezone
    });

    this.isRunning = true;
    console.log('✅ Notification scheduler started - processing every 15 minutes');

    // Run once immediately on startup to catch any pending notifications
    setTimeout(() => {
      this.runNotificationProcess();
    }, 5000); // Wait 5 seconds after startup
  }

  /**
   * Stop the notification scheduler
   */
  static stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }
    this.isRunning = false;
    console.log('🛑 Notification scheduler stopped');
  }

  /**
   * Run the notification processing
   */
  private static async runNotificationProcess(): Promise<void> {
    try {
      console.log('📅 [SCHEDULER] Running 15-minute notification check...');
      const startTime = Date.now();

      const results = await MissedCallNotificationService.processPendingNotifications();

      const duration = Date.now() - startTime;
      
      console.log(`✅ [SCHEDULER] Notification processing completed in ${duration}ms`);
      console.log(`📊 [SCHEDULER] Results: ${results.processed} processed, ${results.successful} successful, ${results.failed} failed`);

      if (results.failed > 0) {
        console.warn(`⚠️ [SCHEDULER] ${results.failed} notifications failed to send`);
        // Log specific failures for debugging
        results.results.forEach(result => {
          if (!result.success) {
            console.error(`❌ [SCHEDULER] Failed for Agent ${result.agent_id} (${result.phone}): ${result.errors.join(', ')}`);
          }
        });
      }

      if (results.successful > 0) {
        console.log(`🎉 [SCHEDULER] Successfully sent ${results.successful} missed call notifications`);
      }

    } catch (error) {
      console.error('❌ [SCHEDULER] Error during notification processing:', error);
    }
  }

  /**
   * Get scheduler status
   */
  static getStatus(): {
    running: boolean;
    nextRun?: string;
  } {
    return {
      running: this.isRunning,
      nextRun: this.cronJob ? 'Every 15 minutes' : undefined
    };
  }

  /**
   * Manually trigger notification processing (for testing)
   */
  static async runNow(): Promise<any> {
    console.log('🔧 [MANUAL] Manually triggering notification processing...');
    return await this.runNotificationProcess();
  }
}