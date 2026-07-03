/**
 * Backfill booked events from masterlead.cnresolution
 * Finds bookings in masterlead that don't have event_type='booked' in agent_dial_metrics
 */

import { supabaseAdmin } from './server/supabase';
import { getDateRangeForTimePeriod } from './server/scripts/calculate-dial-reach-booked-realtime';

async function backfillBookedFromMasterlead() {
  if (!supabaseAdmin) {
    console.error('❌ supabaseAdmin not initialized');
    process.exit(1);
  }

  console.log('\n🚀 BACKFILL BOOKED EVENTS FROM MASTERLEAD\n');
  console.log('═'.repeat(70));

  const { start, end } = getDateRangeForTimePeriod('realtime');
  console.log(`📅 Date range: ${start.toISOString()} to ${end.toISOString()}\n`);

  const stats = {
    processed: 0,
    booked: 0,
    skipped: 0,
    errors: 0
  };

  // Get all booked leads from masterlead
  const { data: bookedLeads, error: leadsError } = await supabaseAdmin
    .from('masterlead')
    .select('id, cn_email, phone, cnresolution, last_contacted, first_name, last_name, state')
    .in('cnresolution', ['booked', 'appointment', 'appointment_set'])
    .gte('last_contacted', start.toISOString())
    .lt('last_contacted', end.toISOString())
    .not('cn_email', 'is', null)
    .neq('cn_email', '');

  if (leadsError) {
    console.error('❌ Error fetching booked leads:', leadsError);
    return;
  }

  console.log(`📊 Found ${bookedLeads?.length || 0} booked leads in masterlead\n`);

  if (!bookedLeads || bookedLeads.length === 0) {
    console.log('✅ No booked leads to process');
    return;
  }

  // Process each booked lead
  for (const lead of bookedLeads) {
    stats.processed++;

    const agentEmail = lead.cn_email?.toLowerCase().trim();
    const phone = (lead.phone || '').replace(/\D/g, '');

    if (!agentEmail || !agentEmail.includes('@') || !phone || phone.length < 10) {
      stats.skipped++;
      continue;
    }

    // Check if booked event already exists
    const callDate = new Date(lead.last_contacted || new Date());
    const dayStart = new Date(callDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);

    const { data: existing } = await supabaseAdmin
      .from('agent_dial_metrics')
      .select('id')
      .eq('agent_email', agentEmail)
      .eq('lead_phone', phone)
      .eq('event_type', 'booked')
      .gte('event_timestamp', dayStart.toISOString())
      .lt('event_timestamp', dayEnd.toISOString())
      .limit(1);

    if (existing && existing.length > 0) {
      stats.skipped++;
      continue;
    }

    // Try to find the call in twilio_call_logs to get duration/status
    const { data: callLog } = await supabaseAdmin
      .from('twilio_call_logs')
      .select('call_duration, call_status, call_started_at, twilio_call_sid')
      .eq('owner_email', agentEmail)
      .eq('to_number', phone)
      .gte('call_started_at', dayStart.toISOString())
      .lt('call_started_at', dayEnd.toISOString())
      .order('call_started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const callDuration = callLog?.call_duration ? parseInt(String(callLog.call_duration), 10) : null;
    const callStatus = callLog?.call_status || 'completed';
    const eventTimestamp = callLog?.call_started_at || lead.last_contacted || new Date().toISOString();

    // Only create booked event if we have call duration (required by validation)
    if (!callDuration || callDuration <= 0) {
      stats.skipped++;
      continue;
    }

    // Insert booked event
    const bookedData = {
      agent_email: agentEmail,
      agent_name: null,
      lead_id: lead.id,
      lead_phone: phone,
      lead_name: `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || null,
      lead_state: lead.state || null,
      event_type: 'booked',
      event_timestamp: eventTimestamp,
      call_duration: callDuration,
      call_status: callStatus,
      disposition: lead.cnresolution,
      call_sid: callLog?.twilio_call_sid || null,
      source: 'masterlead_backfill',
      notes: `Backfilled from masterlead.cnresolution on ${new Date().toISOString()}`,
    };

    const { error: bookedError } = await supabaseAdmin
      .from('agent_dial_metrics')
      .insert(bookedData);

    if (bookedError) {
      console.error(`❌ Error inserting booked for ${agentEmail}:${phone}:`, bookedError.message);
      stats.errors++;
      continue;
    }

    stats.booked++;

    if (stats.processed % 50 === 0) {
      console.log(`   Progress: ${stats.processed} processed, ${stats.booked} booked, ${stats.skipped} skipped, ${stats.errors} errors`);
    }
  }

  console.log('\n' + '═'.repeat(70));
  console.log('📊 BACKFILL COMPLETE');
  console.log('═'.repeat(70));
  console.log(`   Processed: ${stats.processed}`);
  console.log(`   Booked: ${stats.booked}`);
  console.log(`   Skipped: ${stats.skipped} (already logged or invalid)`);
  console.log(`   Errors: ${stats.errors}`);
  console.log('═'.repeat(70));
}

backfillBookedFromMasterlead()
  .then(() => {
    console.log('\n✅ Backfill complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
