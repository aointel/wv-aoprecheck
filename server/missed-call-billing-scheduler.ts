/**
 * Missed Call Billing Scheduler
 * 
 * Automatically scans the blastpick CSV for new missed calls and creates billing transactions
 * Runs every 5 minutes to process missed calls in real-time
 * 
 * Duplicate prevention: Checks for existing billing transactions before creating new ones
 * This ensures all missed calls are billed and agents receive notifications without duplicates
 */

import * as cron from 'node-cron';
import { processMissedCallBilling } from './missed-call-billing-from-csv';

export class MissedCallBillingScheduler {
  private cronJob: cron.ScheduledTask | null = null;
  private isRunning = false;
  private isProcessing = false; // Prevent overlapping runs

  /**
   * Start the missed call billing scheduler
   * 🚨 DISABLED - Missed call billing is currently disabled
   */
  start(): void {
    // 🚨 DISABLED - Missed call billing is currently disabled
    console.log('⚠️ Missed Call Billing Scheduler is DISABLED - not starting');
    return;
    
    /* DISABLED CODE - Uncomment to re-enable
    if (this.isRunning) {
      console.log('⚠️ Missed Call Billing Scheduler already running');
      return;
    }

    console.log('💰 Starting Missed Call Billing Scheduler...');
    
    // Schedule to run every 5 minutes for real-time processing
    // Cron format: minute hour day month weekday
    // Every 5 minutes pattern
    this.cronJob = cron.schedule('*\/5 * * * *', async () => {
      try {
        if (!this.isProcessing) {
          await this.processRecentMissedCalls();
        }
      } catch (error: any) {
        // Reset processing flag on error
        this.isProcessing = false;
      }
    }, {
      scheduled: true,
      timezone: "America/Los_Angeles" // PST timezone
    });

    this.isRunning = true;
    console.log('✅ Missed Call Billing Scheduler started - will process missed calls every 5 minutes');
    
    // Run immediately on startup (wait 10 seconds to let server fully initialize)
    setTimeout(() => {
      this.processRecentMissedCalls().catch(err => {
        console.error('❌ Initial missed call billing failed:', err);
      });
    }, 10000); // Wait 10 seconds after startup
    */
  }

  /**
   * Process recent missed calls (last 7 days to catch any missed ones)
   * The processMissedCallBilling function already handles duplicate prevention
   */
  private async processRecentMissedCalls(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    try {
      await processMissedCallBilling();
    } catch (error: any) {
      // Don't let scheduler errors crash the server - fail silently
    } finally {
      // Always reset processing flag, even on error
      this.isProcessing = false;
    }
  }

  /**
   * Process missed calls for a specific date range
   */
  async processDateRange(startDate: string, endDate: string): Promise<void> {
    try {
      console.log(`📅 Processing missed calls for range: ${startDate} to ${endDate}`);
      
      // Process each day in the range
      const start = new Date(startDate);
      const end = new Date(endDate);
      const current = new Date(start);
      
      while (current <= end) {
        const dateStr = format(current, 'yyyy-MM-dd');
        console.log(`📅 Processing missed calls for: ${dateStr}`);
        await processMissedCallBilling(dateStr);
        current.setDate(current.getDate() + 1);
      }
      
      console.log(`✅ Completed missed call billing for range ${startDate} to ${endDate}`);
    } catch (error: any) {
      console.error('❌ Error processing missed call billing range:', error);
      throw error;
    }
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      this.isRunning = false;
      console.log('⏸️ Missed Call Billing Scheduler stopped');
    }
  }
}

export const missedCallBillingScheduler = new MissedCallBillingScheduler();

