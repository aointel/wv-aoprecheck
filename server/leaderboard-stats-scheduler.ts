/**
 * Periodic scheduler to update leaderboard stats
 * Runs every 2 minutes as a backup to ensure stats stay in sync
 */

import * as cron from 'node-cron';
import { updateAllLeaderboardStats } from './update-leaderboard-stats';

class LeaderboardStatsScheduler {
  private cronJob: cron.ScheduledTask | null = null;
  private isRunning = false;

  start(): void {
    if (this.isRunning) {
      console.log('⚠️ Leaderboard stats scheduler is already running');
      return;
    }

    console.log('🚀 Starting leaderboard stats scheduler (every 2 minutes)...');

    // Run every 2 minutes: */2 * * * *
    this.cronJob = cron.schedule('*/2 * * * *', async () => {
      console.log('🔄 Running periodic leaderboard stats update...');
      try {
        await updateAllLeaderboardStats();
        console.log('✅ Periodic leaderboard stats update completed');
      } catch (error) {
        console.error('❌ Error in periodic leaderboard stats update:', error);
      }
    }, {
      scheduled: true,
      timezone: "America/New_York"
    });

    this.isRunning = true;
    console.log('✅ Leaderboard stats scheduler started - updating every 2 minutes');

    // Run once immediately on startup
    setTimeout(() => {
      updateAllLeaderboardStats().catch(err => {
        console.error('❌ Error in initial leaderboard stats update:', err);
      });
    }, 10000); // Wait 10 seconds after startup
  }

  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }
    this.isRunning = false;
    console.log('⏹️ Leaderboard stats scheduler stopped');
  }
}

export const leaderboardStatsScheduler = new LeaderboardStatsScheduler();
