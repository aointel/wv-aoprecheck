import * as cron from 'node-cron';
import { runChrisHierarchyActivityCardReport } from './activity-card-delivery-service';

export class ActivityCardReportScheduler {
  private cronJob: cron.ScheduledTask | null = null;
  private isRunning = false;

  start(): void {
    if (this.isRunning) return;

    // Weekdays only at 9:00 AM, 12:00 PM, 3:00 PM PST
    this.cronJob = cron.schedule(
      '0 9,12,15 * * 1-5',
      async () => {
        try {
          console.log('⏰ Activity card scheduler trigger fired');
          const result = await runChrisHierarchyActivityCardReport({ trigger: 'scheduler' });
          console.log(`✅ Activity card sent (run=${result.runId}) email=${result.emailSent} mms=${result.mmsSent} errors=${result.errors.length}`);
        } catch (error: any) {
          console.error('❌ Activity card scheduler run failed:', error?.message || error);
        }
      },
      {
        scheduled: true,
        timezone: 'America/Los_Angeles',
      }
    );

    this.isRunning = true;
    console.log('✅ Activity card report scheduler started (Mon-Fri 9:00/12:00/15:00 PST)');
  }

  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }
    this.isRunning = false;
  }
}

export const activityCardReportScheduler = new ActivityCardReportScheduler();

