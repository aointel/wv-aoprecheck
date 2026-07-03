import * as cron from 'node-cron';
import { AgentBillingEmailService } from './agent-billing-email-service';

export class DailyBillingScheduler {
  private emailService: AgentBillingEmailService;
  private isRunning = false;

  constructor() {
    this.emailService = new AgentBillingEmailService();
  }

  start(): void {
    if (this.isRunning) {
      console.log('⚠️ Daily billing scheduler already running');
      return;
    }

    console.log('🕒 Starting daily billing email scheduler...');
    
    // Schedule daily emails at 8:00 AM EST every day
    cron.schedule('0 8 * * *', async () => {
      console.log('⏰ Daily billing email trigger - 8:00 AM EST');
      await this.runDailyBillingProcess();
    }, {
      scheduled: true,
      timezone: "America/New_York"
    });

    this.isRunning = true;
    console.log('✅ Daily billing scheduler started - emails will be sent at 8:00 AM EST daily');
  }

  stop(): void {
    if (!this.isRunning) {
      console.log('⚠️ Daily billing scheduler not running');
      return;
    }

    this.isRunning = false;
    console.log('🛑 Daily billing scheduler stopped');
  }

  async runDailyBillingProcess(): Promise<void> {
    console.log('🚀 DAILY BILLING PROCESS: Starting email delivery');
    
    try {
      await this.emailService.sendDailyBillingSummaries();
      console.log('✅ DAILY BILLING COMPLETE: All emails processed');
    } catch (error) {
      console.error('❌ DAILY BILLING ERROR:', error);
    }
  }

  // Manual trigger for testing
  async triggerManualSend(): Promise<void> {
    console.log('🔧 Manual trigger: Daily billing email process');
    await this.runDailyBillingProcess();
  }

  // Test email trigger
  async sendTestEmail(email: string, associateId: string): Promise<boolean> {
    console.log(`📧 Sending test email to ${email} for agent ${associateId}`);
    return await this.emailService.sendTestEmail(email, associateId);
  }

  getStatus(): { isRunning: boolean; nextRun: string } {
    return {
      isRunning: this.isRunning,
      nextRun: this.isRunning ? 'Daily at 8:00 AM EST' : 'Not scheduled'
    };
  }
}