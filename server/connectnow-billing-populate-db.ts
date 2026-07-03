/**
 * ConnectNow Billing Summary Database Population Script
 * Populates the connectnow_billing_summary table with daily billing and sign-up metrics
 */

import { supabaseAdmin } from './supabase';
import { format, parse, eachDayOfInterval, addDays } from 'date-fns';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

interface BillingSummaryData {
  date: string;
  precheck_billed: number;
  precheck_sign_ups: number;
  call_connector_pro_active_accounts: number;
  call_connector_pro_sign_ups: number;
}

/**
 * Populate billing summary for a single date
 */
async function populateBillingDate(dateStr: string): Promise<void> {
  const dateObj = parse(dateStr, 'yyyy-MM-dd', new Date());
  const dateStart = format(dateObj, 'yyyy-MM-dd') + 'T00:00:00';
  const dateEnd = format(dateObj, 'yyyy-MM-dd') + 'T23:59:59';

  console.log(`📅 Processing billing data for ${dateStr}...`);

  // Fetch Pre-Check billed count (completed sessions for the day)
  const { count: precheckBilled, error: precheckBilledError } = await supabaseAdmin
    .from('verification_sessions')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'completed')
    .gte('completed_at', dateStart)
    .lte('completed_at', dateEnd);

  if (precheckBilledError) {
    console.error(`❌ Error fetching Pre-Check billed for ${dateStr}:`, precheckBilledError);
  }

  // Fetch Pre-Check sign-ups (sessions created on this date)
  const { count: precheckSignUps, error: precheckSignUpsError } = await supabaseAdmin
    .from('verification_sessions')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', dateStart)
    .lte('created_at', dateEnd);

  if (precheckSignUpsError) {
    console.error(`❌ Error fetching Pre-Check sign-ups for ${dateStr}:`, precheckSignUpsError);
  }

  // Fetch Call Connector Pro sign-ups (trials started on this date OR subscriptions created on this date)
  // Count subscriptions where trial_started_at is in date range, or if no trial, use created_at when plan is professional/elite
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

  // Fetch Call Connector Pro active accounts (active/trialing subscriptions that existed on this date)
  // We count subscriptions that were created before or on this date and are currently active/trialing
  const { data: ccpSubscriptions, error: ccpActiveError } = await supabaseAdmin
    .from('connectnow_subscriptions')
    .select('user_email, status, plan, created_at')
    .in('status', ['active', 'trialing'])
    .in('plan', ['professional', 'elite']);

  if (ccpActiveError) {
    console.error(`❌ Error fetching Call Connector Pro active accounts for ${dateStr}:`, ccpActiveError);
  }

  // Count unique active accounts that existed on this date
  let ccpActiveAccounts = 0;
  if (ccpSubscriptions) {
    const dateEndObj = new Date(dateEnd);
    const activeAccounts = new Set<string>();
    for (const sub of ccpSubscriptions) {
      const createdAt = sub.created_at ? new Date(sub.created_at) : new Date();
      // If subscription was created before or on this date, count it as active on this date
      if (createdAt <= dateEndObj) {
        activeAccounts.add(sub.user_email);
      }
    }
    ccpActiveAccounts = activeAccounts.size;
  }

  const billingData: BillingSummaryData = {
    date: format(dateObj, 'yyyy-MM-dd'),
    precheck_billed: precheckBilled || 0,
    precheck_sign_ups: precheckSignUps || 0,
    call_connector_pro_active_accounts: ccpActiveAccounts,
    call_connector_pro_sign_ups: ccpSignUps || 0,
  };

  // Upsert the billing summary data
  const { error: upsertError } = await supabaseAdmin
    .from('connectnow_billing_summary')
    .upsert([billingData], {
      onConflict: 'date',
      ignoreDuplicates: false,
    });

  if (upsertError) {
    console.error(`❌ Error upserting billing summary for ${dateStr}:`, upsertError);
    throw upsertError;
  }

  console.log(`✅ Inserted billing summary for ${dateStr}:`, {
    precheckBilled: billingData.precheck_billed,
    precheckSignUps: billingData.precheck_sign_ups,
    ccpActiveAccounts: billingData.call_connector_pro_active_accounts,
    ccpSignUps: billingData.call_connector_pro_sign_ups,
  });
}

/**
 * Populate billing summary for a date range
 */
async function populateBillingDatabase(startDate?: string, endDate?: string): Promise<void> {
  console.log('💰 Starting ConnectNow Billing Summary database population...');

  let datesToProcess: Date[] = [];

  if (startDate && endDate) {
    // Process date range
    const start = parse(startDate, 'M/d/yyyy', new Date());
    const end = parse(endDate, 'M/d/yyyy', new Date());
    datesToProcess = eachDayOfInterval({ start, end });
    console.log(`📅 Processing date range: ${startDate} to ${endDate} (${datesToProcess.length} days)`);
  } else {
    // Process last 90 days by default
    const end = new Date();
    const start = addDays(end, -90);
    datesToProcess = eachDayOfInterval({ start, end });
    console.log(`📅 Processing last 90 days: ${format(start, 'M/d/yyyy')} to ${format(end, 'M/d/yyyy')} (${datesToProcess.length} days)`);
  }

  // Process each date
  let processed = 0;
  let failed = 0;

  for (const dateObj of datesToProcess) {
    try {
      const dateStr = format(dateObj, 'yyyy-MM-dd');
      await populateBillingDate(dateStr);
      processed++;

      // Small delay to avoid overwhelming the database
      if (processed % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error: any) {
      console.error(`❌ Failed to process ${format(dateObj, 'M/d/yyyy')}:`, error.message);
      failed++;
    }
  }

  console.log(`\n✅ Billing summary population complete!`);
  console.log(`   Processed: ${processed} dates`);
  if (failed > 0) {
    console.log(`   Failed: ${failed} dates`);
  }
}

/**
 * Update billing summary for the current rolling week (Thursday - Wednesday PST)
 */
async function updateCurrentRollingWeek(): Promise<void> {
  console.log('💰 Updating current rolling week billing summary...');

  // Calculate current rolling week (Thursday to Wednesday PST)
  const now = new Date();
  const pstOffset = -8 * 60; // PST is UTC-8
  const pstNow = new Date(now.getTime() + (now.getTimezoneOffset() + pstOffset) * 60 * 1000);

  // Find most recent Thursday
  let weekStart = new Date(pstNow);
  const dayOfWeek = weekStart.getDay(); // 0 = Sunday, 4 = Thursday
  const daysSinceThursday = (dayOfWeek + 3) % 7; // Days since last Thursday
  if (daysSinceThursday > 0) {
    weekStart = addDays(weekStart, -daysSinceThursday);
  }
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = addDays(weekStart, 6); // Wednesday
  weekEnd.setHours(23, 59, 59, 999);

  const startDateStr = format(weekStart, 'M/d/yyyy');
  const endDateStr = format(weekEnd, 'M/d/yyyy');

  console.log(`📅 Rolling week: ${startDateStr} (Thursday) to ${endDateStr} (Wednesday) PST`);

  await populateBillingDatabase(startDateStr, endDateStr);
}

// CLI usage
const args = process.argv.slice(2);

if (args[0] === '--week' || args[0] === '-w') {
  // Update current rolling week
  updateCurrentRollingWeek()
    .then(() => {
      console.log('✅ Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
} else if (args[0] === '--all' || args[0] === '-a') {
  // Populate all dates (last 90 days)
  populateBillingDatabase()
    .then(() => {
      console.log('✅ Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
} else if (args[0] && args[1]) {
  // Populate date range
  populateBillingDatabase(args[0], args[1])
    .then(() => {
      console.log('✅ Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
} else {
  console.log('Usage:');
  console.log('  tsx server/connectnow-billing-populate-db.ts --week          Update current rolling week');
  console.log('  tsx server/connectnow-billing-populate-db.ts --all           Populate last 90 days');
  console.log('  tsx server/connectnow-billing-populate-db.ts <start> <end>   Populate date range (M/d/yyyy)');
  console.log('');
  console.log('Example:');
  console.log('  tsx server/connectnow-billing-populate-db.ts 11/21/2025 11/27/2025');
  process.exit(1);
}

