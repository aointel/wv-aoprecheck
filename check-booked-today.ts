/**
 * Simple check: How many leads got booked disposition today
 */

import { supabaseAdmin } from './server/supabase';
import { getDateRangeForTimePeriod } from './server/scripts/calculate-dial-reach-booked-realtime';

async function checkBookedToday() {
  if (!supabaseAdmin) {
    console.error('❌ supabaseAdmin not initialized');
    process.exit(1);
  }

  const { start, end } = getDateRangeForTimePeriod('realtime');
  console.log(`📅 Today (EST): ${start.toISOString()} to ${end.toISOString()}\n`);

  // Count leads with booked disposition today
  const { count, error } = await supabaseAdmin
    .from('masterlead')
    .select('*', { count: 'exact', head: true })
    .in('cnresolution', ['booked', 'appointment', 'appointment_set'])
    .gte('last_contacted', start.toISOString())
    .lt('last_contacted', end.toISOString());

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log(`📊 Leads with booked disposition today: ${count || 0}`);
}

checkBookedToday()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
