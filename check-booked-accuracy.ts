/**
 * Check booked accuracy - compare agent_dial_metrics vs masterlead.cnresolution
 */

import { supabaseAdmin } from './server/supabase';
import { getDateRangeForTimePeriod } from './server/scripts/calculate-dial-reach-booked-realtime';

async function checkBookedAccuracy() {
  if (!supabaseAdmin) {
    console.error('❌ supabaseAdmin not initialized');
    process.exit(1);
  }

  console.log('\n🔍 CHECKING BOOKED ACCURACY\n');
  console.log('═'.repeat(70));

  const { start, end } = getDateRangeForTimePeriod('realtime');
  console.log(`📅 Date range: ${start.toISOString()} to ${end.toISOString()}\n`);

  // 1. Count booked from agent_dial_metrics (event_type = 'booked')
  const { data: bookedMetrics, error: metricsError } = await supabaseAdmin
    .from('agent_dial_metrics')
    .select('agent_email, lead_phone, disposition, call_duration, event_timestamp')
    .eq('event_type', 'booked')
    .gte('event_timestamp', start.toISOString())
    .lt('event_timestamp', end.toISOString());

  if (metricsError) {
    console.error('❌ Error fetching booked from agent_dial_metrics:', metricsError);
    return;
  }

  const bookedFromMetrics = new Set<string>();
  (bookedMetrics || []).forEach(m => {
    const key = `${m.agent_email}:${m.lead_phone}`;
    bookedFromMetrics.add(key);
  });

  console.log(`📊 Booked from agent_dial_metrics (event_type='booked'): ${bookedFromMetrics.size} unique phone/agent combinations\n`);

  // 2. Count booked from masterlead (cnresolution = 'booked')
  const { data: bookedLeads, error: leadsError } = await supabaseAdmin
    .from('masterlead')
    .select('cn_email, phone, cnresolution, last_contacted')
    .in('cnresolution', ['booked', 'appointment', 'appointment_set'])
    .gte('last_contacted', start.toISOString())
    .lt('last_contacted', end.toISOString());

  if (leadsError) {
    console.error('❌ Error fetching booked from masterlead:', leadsError);
    return;
  }

  const bookedFromMasterlead = new Set<string>();
  (bookedLeads || []).forEach(lead => {
    const email = lead.cn_email?.toLowerCase().trim();
    const phone = (lead.phone || '').replace(/\D/g, '');
    if (email && phone && phone.length >= 10) {
      const key = `${email}:${phone}`;
      bookedFromMasterlead.add(key);
    }
  });

  console.log(`📊 Booked from masterlead (cnresolution='booked/appointment'): ${bookedFromMasterlead.size} unique phone/agent combinations\n`);

  // 3. Compare
  console.log('═'.repeat(70));
  console.log('📊 COMPARISON:\n');
  console.log(`   agent_dial_metrics (event_type='booked'): ${bookedFromMetrics.size}`);
  console.log(`   masterlead (cnresolution='booked/appointment'): ${bookedFromMasterlead.size}`);
  console.log(`   Difference: ${Math.abs(bookedFromMetrics.size - bookedFromMasterlead.size)}\n`);

  // Find missing
  const missingInMetrics = Array.from(bookedFromMasterlead).filter(key => !bookedFromMetrics.has(key));
  const missingInMasterlead = Array.from(bookedFromMetrics).filter(key => !bookedFromMasterlead.has(key));

  if (missingInMetrics.length > 0) {
    console.log(`⚠️  ${missingInMetrics.length} bookings in masterlead but NOT in agent_dial_metrics:`);
    missingInMetrics.slice(0, 10).forEach(key => {
      const [email, phone] = key.split(':');
      console.log(`   ${email}: ${phone}`);
    });
    if (missingInMetrics.length > 10) {
      console.log(`   ... and ${missingInMetrics.length - 10} more`);
    }
    console.log('');
  }

  if (missingInMasterlead.length > 0) {
    console.log(`⚠️  ${missingInMasterlead.length} bookings in agent_dial_metrics but NOT in masterlead:`);
    missingInMasterlead.slice(0, 10).forEach(key => {
      const [email, phone] = key.split(':');
      console.log(`   ${email}: ${phone}`);
    });
    if (missingInMasterlead.length > 10) {
      console.log(`   ... and ${missingInMasterlead.length - 10} more`);
    }
    console.log('');
  }

  if (missingInMetrics.length === 0 && missingInMasterlead.length === 0) {
    console.log('✅ Booked counts match between agent_dial_metrics and masterlead\n');
  }

  console.log('═'.repeat(70));
}

checkBookedAccuracy()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
