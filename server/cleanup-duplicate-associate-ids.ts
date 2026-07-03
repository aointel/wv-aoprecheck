/**
 * Scheduled task: Clean up duplicate associate_ids from customers table
 * Runs at midnight to remove duplicates, keeping the most complete record
 */

import * as cron from 'node-cron';
import { supabaseAdmin } from './supabase';

export class DuplicateAssociateIdCleanupScheduler {
  private cronJob: cron.ScheduledTask | null = null;
  private isRunning = false;

  /**
   * Start the daily cleanup scheduler (runs at midnight)
   */
  start(): void {
    if (this.isRunning) {
      console.log('⚠️ Duplicate Associate ID Cleanup Scheduler already running');
      return;
    }

    console.log('🗑️ Starting Duplicate Associate ID Cleanup Scheduler...');
    
    // Schedule daily cleanup at 12:00 AM (midnight)
    // Cron format: minute hour day month weekday
    // '0 0 * * *' = every day at midnight
    this.cronJob = cron.schedule('0 0 * * *', async () => {
      console.log(`[${new Date().toISOString()}] ⏰ Midnight cleanup trigger - removing duplicate associate_ids`);
      await cleanupDuplicateAssociateIds();
    }, {
      scheduled: true,
      timezone: "America/Los_Angeles" // PST timezone
    });

    this.isRunning = true;
    console.log('✅ Duplicate Associate ID Cleanup Scheduler started - will run daily at 12:00 AM PST');
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
    console.log('🛑 Duplicate Associate ID Cleanup Scheduler stopped');
  }

  /**
   * Get scheduler status
   */
  getStatus(): { isRunning: boolean } {
    return { isRunning: this.isRunning };
  }

  /**
   * Manually trigger cleanup (for testing/admin)
   */
  async triggerManualCleanup(): Promise<{ success: boolean; deleted?: number; errors?: number; duplicates?: number; error?: string }> {
    console.log('🔧 Manual cleanup triggered');
    return await cleanupDuplicateAssociateIds();
  }
}

async function cleanupDuplicateAssociateIds() {
  console.log(`[${new Date().toISOString()}] 🗑️ Cleaning up duplicate associate_ids from customers table\n`);

  try {
    // Get all customers with associate_id
    const { data: allCustomers, error: fetchError } = await supabaseAdmin
      .from('customers')
      .select('id, associate_id, company_email, personal_email, first_name, last_name, created_at')
      .not('associate_id', 'is', null);

    if (fetchError) {
      console.error(`[${new Date().toISOString()}] ❌ Error fetching customers:`, fetchError);
      return { success: false, error: fetchError.message };
    }

    // Find duplicates
    const associateIdMap = new Map<number, Array<{
      id: string;
      associate_id: number;
      company_email: string | null;
      personal_email: string | null;
      first_name: string | null;
      last_name: string | null;
      created_at: string | null;
      completeness: number;
    }>>();

    allCustomers?.forEach(c => {
      const associateId = Number(c.associate_id);
      if (!associateId) return;

      if (!associateIdMap.has(associateId)) {
        associateIdMap.set(associateId, []);
      }

      // Calculate completeness score (higher = more complete)
      let completeness = 0;
      if (c.company_email) completeness += 2;
      if (c.personal_email) completeness += 1;
      if (c.first_name) completeness += 1;
      if (c.last_name) completeness += 1;

      associateIdMap.get(associateId)!.push({
        id: c.id,
        associate_id: associateId,
        company_email: c.company_email,
        personal_email: c.personal_email,
        first_name: c.first_name,
        last_name: c.last_name,
        created_at: c.created_at,
        completeness
      });
    });

    // Filter to only duplicates
    const duplicates = Array.from(associateIdMap.entries())
      .filter(([_, records]) => records.length > 1);

    if (duplicates.length === 0) {
      console.log(`[${new Date().toISOString()}] ✅ No duplicate associate_ids found`);
      return { success: true, deleted: 0, duplicates: 0 };
    }

    console.log(`[${new Date().toISOString()}] 📊 Found ${duplicates.length} duplicate associate_ids affecting ${duplicates.reduce((sum, [_, records]) => sum + records.length, 0)} records`);

    let deleted = 0;
    let errors = 0;
    const toDelete: string[] = [];

    // For each duplicate set, determine which to keep and which to delete
    for (const [associateId, records] of duplicates) {
      // Sort by completeness (highest first), then by created_at (oldest first)
      const sorted = [...records].sort((a, b) => {
        if (b.completeness !== a.completeness) {
          return b.completeness - a.completeness;
        }
        const aDate = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bDate = b.created_at ? new Date(b.created_at).getTime() : 0;
        return aDate - bDate;
      });

      const keep = sorted[0];
      const deleteThese = sorted.slice(1);

      for (const del of deleteThese) {
        toDelete.push(del.id);
      }
    }

    // Delete duplicates
    for (const id of toDelete) {
      const { error } = await supabaseAdmin
        .from('customers')
        .delete()
        .eq('id', id);

      if (error) {
        console.error(`[${new Date().toISOString()}] ❌ Error deleting ${id}: ${error.message}`);
        errors++;
      } else {
        deleted++;
      }
    }

    console.log(`[${new Date().toISOString()}] ✅ Cleanup complete: ${deleted} records deleted, ${errors} errors`);

    return {
      success: true,
      deleted,
      errors,
      duplicates: duplicates.length
    };
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Fatal error:`, error);
    return { success: false, error: String(error) };
  }
}

// If run directly (for testing or manual execution)
if (require.main === module) {
  cleanupDuplicateAssociateIds()
    .then((result) => {
      console.log('\n✅ Cleanup complete:', result);
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error('\n❌ Cleanup failed:', error);
      process.exit(1);
    });
}
