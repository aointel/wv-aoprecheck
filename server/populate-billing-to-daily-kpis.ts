/**
 * Populate billing data (Pre-Check and Call Connector Pro) into connectnow_daily_kpis table
 * This script adds billing columns if needed and populates data for specified dates
 */

import { supabaseAdmin } from './supabase';
import { format, parse, eachDayOfInterval, addDays } from 'date-fns';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

interface BillingData {
  date: string;
  precheck_billed: number;
  precheck_sign_ups: number;
  call_connector_pro_active_accounts: number;
  call_connector_pro_sign_ups: number;
}

/**
 * Populate billing data for a single date into all campaign rows for that date
 */
async function populateBillingForDate(dateStr: string): Promise<void> {
  const dateObj = parse(dateStr, 'yyyy-MM-dd', new Date());
  const dateStart = format(dateObj, 'yyyy-MM-dd') + 'T00:00:00';
  const dateEnd = format(dateObj, 'yyyy-MM-dd') + 'T23:59:59';

  console.log(`📅 Processing billing data for ${dateStr}...`);

  // Fetch Pre-Check billed (sessions with taalk_call_url created during the day)
  const { count: precheckBilled, error: precheckBilledError } = await supabaseAdmin
    .from('verification_sessions')
    .select('*', { count: 'exact', head: true })
    .not('taalk_call_url', 'is', null)
    .gte('created_at', dateStart)
    .lte('created_at', dateEnd);

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

  // Fetch Call Connector Pro active accounts (active/trialing subscriptions that existed on this date)
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
      if (createdAt <= dateEndObj) {
        activeAccounts.add(sub.user_email);
      }
    }
    ccpActiveAccounts = activeAccounts.size;
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

  const billingData: BillingData = {
    date: format(dateObj, 'yyyy-MM-dd'),
    precheck_billed: precheckBilled || 0,
    precheck_sign_ups: precheckSignUps || 0,
    call_connector_pro_active_accounts: ccpActiveAccounts,
    call_connector_pro_sign_ups: ccpSignUps || 0,
  };

  console.log(`📊 Billing data for ${dateStr}:`, billingData);

  // Update all campaign rows for this date with the billing data
  // Since billing is daily totals (not per campaign), we update all rows for the date
  const { error: updateError } = await supabaseAdmin
    .from('connectnow_daily_kpis')
    .update({
      precheck_billed: billingData.precheck_billed,
      precheck_sign_ups: billingData.precheck_sign_ups,
      call_connector_pro_active_accounts: billingData.call_connector_pro_active_accounts,
      call_connector_pro_sign_ups: billingData.call_connector_pro_sign_ups,
    })
    .eq('date', billingData.date);

  if (updateError) {
    console.error(`❌ Error updating billing data for ${dateStr}:`, updateError);
    throw updateError;
  }

  // Check how many rows were updated
  const { count: updatedCount } = await supabaseAdmin
    .from('connectnow_daily_kpis')
    .select('*', { count: 'exact', head: true })
    .eq('date', billingData.date);

  console.log(`✅ Updated billing data for ${dateStr} (${updatedCount || 0} campaign rows)`);
}

/**
 * Get current rolling week (Thursday to Wednesday PST)
 */
function getCurrentRollingWeekPST(): { start: Date; end: Date } {
  const now = new Date();
  const pstOffset = -8 * 60; // PST is UTC-8
  const pstNow = new Date(now.getTime() + (now.getTimezoneOffset() + pstOffset) * 60 * 1000);
  
  let weekStart = new Date(pstNow);
  const dayOfWeek = weekStart.getDay();
  const daysSinceThursday = (dayOfWeek + 3) % 7;
  
  if (daysSinceThursday > 0) {
    weekStart.setDate(weekStart.getDate() - daysSinceThursday);
  }
  weekStart.setHours(0, 0, 0, 0);
  
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  
  return { start: weekStart, end: weekEnd };
}

async function main() {
  // Get args, handling npm's double dash separator
  const args = process.argv.slice(2).filter(arg => arg !== '--');
  
  console.log('🚀 Starting billing data population for connectnow_daily_kpis table...\n');
  console.log('📝 Arguments received:', args);

  let datesToProcess: string[] = [];

  if (args.includes('--week') || args.includes('week')) {
    // Populate current rolling week
    const { start, end } = getCurrentRollingWeekPST();
    const days = eachDayOfInterval({ start, end });
    datesToProcess = days.map(d => format(d, 'yyyy-MM-dd'));
    console.log(`📅 Populating current rolling week: ${format(start, 'yyyy-MM-dd')} to ${format(end, 'yyyy-MM-dd')}`);
  } else if (args.includes('--all') || args.includes('all')) {
    // Populate last 90 days
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    datesToProcess = days.map(d => format(d, 'yyyy-MM-dd'));
    console.log(`📅 Populating last 90 days: ${format(startDate, 'yyyy-MM-dd')} to ${format(endDate, 'yyyy-MM-dd')}`);
  } else if (args.length >= 2) {
    // Specific date range
    const startDate = parse(args[0], 'M/d/yyyy', new Date());
    const endDate = parse(args[1], 'M/d/yyyy', new Date());
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    datesToProcess = days.map(d => format(d, 'yyyy-MM-dd'));
    console.log(`📅 Populating date range: ${args[0]} to ${args[1]}`);
  } else {
    console.log('Usage:');
    console.log('  --week              Populate current rolling week (Thursday-Wednesday PST)');
    console.log('  --all               Populate last 90 days');
    console.log('  <start> <end>       Populate specific date range (MM/DD/YYYY format)');
    console.log('\nExample:');
    console.log('  npm run populate-billing-daily-kpis -- --week');
    console.log('  npm run populate-billing-daily-kpis -- 12/4/2025 12/10/2025');
    process.exit(1);
  }

  console.log(`\n📊 Processing ${datesToProcess.length} dates...\n`);

  for (const dateStr of datesToProcess) {
    try {
      await populateBillingForDate(dateStr);
    } catch (error) {
      console.error(`❌ Failed to process ${dateStr}:`, error);
    }
  }

  console.log('\n✅ Billing data population complete!');
}

// Check if this is the main module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const isMainModule = import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith(__filename);

if (isMainModule || process.argv[1]?.includes('populate-billing-to-daily-kpis')) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Fatal error:', error);
      process.exit(1);
    });
}

