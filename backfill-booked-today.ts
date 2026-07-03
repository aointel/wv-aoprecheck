/**
 * Backfill booked events from masterlead for TODAY
 * Finds bookings in masterlead that don't have event_type='booked' in agent_dial_metrics
 * Specifically for today's data
 */

import { supabaseAdmin } from './server/supabase';
import { getTodayEST } from './server/scripts/calculate-dial-reach-booked-realtime';

async function backfillBookedToday() {
  if (!supabaseAdmin) {
    console.error('❌ supabaseAdmin not initialized');
    process.exit(1);
  }

  console.log('\n🚀 BACKFILL BOOKED EVENTS FROM MASTERLEAD - TODAY\n');
  console.log('═'.repeat(70));

  const { start, end } = getTodayEST();
  console.log(`📅 Date range (EST): ${start.toLocaleString('en-US', { timeZone: 'America/New_York' })} to ${end.toLocaleString('en-US', { timeZone: 'America/New_York' })}`);
  console.log(`📅 Date range (UTC): ${start.toISOString()} to ${end.toISOString()}\n`);

  const stats = {
    processed: 0,
    booked: 0,
    skipped: 0,
    errors: 0,
    noDuration: 0,
    alreadyExists: 0
  };

  // Get all booked leads from masterlead for today
  // Check both last_contacted and updated_at to catch all bookings
  const { data: bookedLeads, error: leadsError } = await supabaseAdmin
    .from('masterlead')
    .select('id, cn_email, phone, cnresolution, last_contacted, updated_at, first_name, last_name, state')
    .in('cnresolution', ['booked', 'appointment', 'appointment_set'])
    .or(`last_contacted.gte.${start.toISOString()},updated_at.gte.${start.toISOString()}`)
    .lt('last_contacted', end.toISOString())
    .not('cn_email', 'is', null)
    .neq('cn_email', '');

  if (leadsError) {
    console.error('❌ Error fetching booked leads:', leadsError);
    return;
  }

  console.log(`📊 Found ${bookedLeads?.length || 0} booked leads in masterlead for today\n`);

  if (!bookedLeads || bookedLeads.length === 0) {
    console.log('✅ No booked leads to process');
    return;
  }

  // Get agent names for better logging
  const agentEmails = [...new Set(bookedLeads.map(l => l.cn_email?.toLowerCase().trim()).filter(Boolean))];
  const { data: agentNames } = await supabaseAdmin
    .from('agent_hierarchy')
    .select('agent_email, agent_name')
    .in('agent_email', agentEmails);

  const agentNameMap = new Map<string, string>();
  (agentNames || []).forEach(a => {
    if (a.agent_email && a.agent_name) {
      agentNameMap.set(a.agent_email.toLowerCase(), a.agent_name);
    }
  });

  // Process each booked lead
  for (const lead of bookedLeads) {
    stats.processed++;

    const agentEmail = lead.cn_email?.toLowerCase().trim();
    const phone = (lead.phone || '').replace(/\D/g, '').slice(-10);

    if (!agentEmail || !agentEmail.includes('@') || !phone || phone.length < 10) {
      stats.skipped++;
      continue;
    }

    // Check if booked event already exists for today
    const { data: existing } = await supabaseAdmin
      .from('agent_dial_metrics')
      .select('id')
      .eq('agent_email', agentEmail)
      .eq('lead_phone', phone)
      .eq('event_type', 'booked')
      .gte('event_timestamp', start.toISOString())
      .lt('event_timestamp', end.toISOString())
      .limit(1);

    if (existing && existing.length > 0) {
      stats.alreadyExists++;
      continue;
    }

    // Try to find the call in twilio_call_logs to get duration/status
    // Look for calls within the last 7 days to this phone number
    const sevenDaysAgo = new Date(start);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: callLogs } = await supabaseAdmin
      .from('twilio_call_logs')
      .select('call_duration, call_status, call_started_at, twilio_call_sid, owner_email')
      .eq('owner_email', agentEmail)
      .eq('to_number', phone)
      .gte('call_started_at', sevenDaysAgo.toISOString())
      .lt('call_started_at', end.toISOString())
      .not('call_duration', 'is', null)
      .gt('call_duration', 0)
      .order('call_started_at', { ascending: false })
      .limit(5);

    // Find the most recent call with valid duration
    const callLog = callLogs?.find(c => c.call_duration && c.call_duration > 0);

    if (!callLog || !callLog.call_duration || callLog.call_duration <= 0) {
      stats.noDuration++;
      console.warn(`⚠️ No valid call duration found for ${agentEmail} -> ${phone} (lead_id: ${lead.id})`);
      continue;
    }

    const callDuration = parseInt(String(callLog.call_duration), 10);
    const callStatus = callLog.call_status || 'completed';
    const eventTimestamp = callLog.call_started_at || lead.last_contacted || lead.updated_at || new Date().toISOString();

    // Insert booked event
    const agentName = agentNameMap.get(agentEmail) || null;
    const bookedData = {
      agent_email: agentEmail,
      agent_name: agentName,
      lead_id: lead.id,
      lead_phone: phone,
      lead_name: `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || null,
      lead_state: lead.state || null,
      event_type: 'booked',
      event_timestamp: eventTimestamp,
      call_duration: callDuration,
      call_status: callStatus,
      disposition: lead.cnresolution?.toLowerCase() || 'booked',
      call_sid: callLog.twilio_call_sid || null,
      source: 'masterlead_backfill_today',
      notes: `Backfilled from masterlead.cnresolution on ${new Date().toISOString()}`,
    };

    const { error: bookedError } = await supabaseAdmin
      .from('agent_dial_metrics')
      .insert(bookedData);

    if (bookedError) {
      console.error(`❌ Error inserting booked for ${agentEmail}:${phone} (lead_id: ${lead.id}):`, bookedError.message);
      stats.errors++;
      continue;
    }

    stats.booked++;
    const name = agentName || agentEmail.split('@')[0];
    console.log(`✅ Booked: ${name} -> ${phone} (${callDuration}s, lead_id: ${lead.id})`);

    if (stats.processed % 25 === 0) {
      console.log(`\n   Progress: ${stats.processed} processed, ${stats.booked} booked, ${stats.alreadyExists} already exist, ${stats.noDuration} no duration, ${stats.errors} errors\n`);
    }
  }

  console.log('\n' + '═'.repeat(70));
  console.log('📊 BACKFILL COMPLETE');
  console.log('═'.repeat(70));
  console.log(`   Processed: ${stats.processed}`);
  console.log(`   ✅ Booked: ${stats.booked}`);
  console.log(`   ⏭️  Already exists: ${stats.alreadyExists}`);
  console.log(`   ⚠️  No duration: ${stats.noDuration}`);
  console.log(`   ❌ Errors: ${stats.errors}`);
  console.log(`   ⏭️  Skipped (invalid): ${stats.skipped}`);
  console.log('═'.repeat(70));
}

backfillBookedToday()
  .then(() => {
    console.log('\n✅ Backfill complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
