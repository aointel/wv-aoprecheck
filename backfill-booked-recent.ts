/**
 * Backfill booked events from masterlead for RECENT PERIOD
 * Finds bookings in masterlead that don't have event_type='booked' in agent_dial_metrics
 * Checks last 30 days by default, or custom date range
 */

import { supabaseAdmin } from './server/supabase';
import { getDateRangeForTimePeriod } from './server/scripts/calculate-dial-reach-booked-realtime';

// Default to last 30 days, but can be overridden
const DAYS_BACK = process.env.DAYS_BACK ? parseInt(process.env.DAYS_BACK) : 30;

async function backfillBookedRecent() {
  if (!supabaseAdmin) {
    console.error('❌ supabaseAdmin not initialized');
    process.exit(1);
  }

  console.log('\n🚀 BACKFILL BOOKED EVENTS FROM MASTERLEAD - RECENT PERIOD\n');
  console.log('═'.repeat(70));

  // Get date range - last N days
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - DAYS_BACK);
  
  // Use EST timezone for consistency
  const { start: todayStart } = getDateRangeForTimePeriod('realtime');
  const estOffset = todayStart.getTime() - new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })).getTime();
  
  // Adjust start/end to EST boundaries
  const startEST = new Date(start.getTime() - estOffset);
  startEST.setHours(0, 0, 0, 0);
  const endEST = new Date(end.getTime() - estOffset);
  endEST.setHours(23, 59, 59, 999);

  console.log(`📅 Checking last ${DAYS_BACK} days`);
  console.log(`📅 Date range (EST): ${startEST.toLocaleString('en-US', { timeZone: 'America/New_York' })} to ${endEST.toLocaleString('en-US', { timeZone: 'America/New_York' })}`);
  console.log(`📅 Date range (UTC): ${startEST.toISOString()} to ${endEST.toISOString()}\n`);

  const stats = {
    processed: 0,
    booked: 0,
    skipped: 0,
    errors: 0,
    noDuration: 0,
    alreadyExists: 0
  };

  // Get all booked leads from masterlead for the period
  // Check both last_contacted and updated_at to catch all bookings
  const { data: bookedLeads, error: leadsError } = await supabaseAdmin
    .from('masterlead')
    .select('id, cn_email, phone, cnresolution, last_contacted, updated_at, first_name, last_name, state')
    .in('cnresolution', ['booked', 'appointment', 'appointment_set'])
    .or(`last_contacted.gte.${startEST.toISOString()},updated_at.gte.${startEST.toISOString()}`)
    .lt('last_contacted', endEST.toISOString())
    .not('cn_email', 'is', null)
    .neq('cn_email', '')
    .order('last_contacted', { ascending: false });

  if (leadsError) {
    console.error('❌ Error fetching booked leads:', leadsError);
    return;
  }

  console.log(`📊 Found ${bookedLeads?.length || 0} booked leads in masterlead for the period\n`);

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

    // Determine the date range for this specific lead
    const leadDate = new Date(lead.last_contacted || lead.updated_at || new Date());
    const dayStart = new Date(leadDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);

    // Check if booked event already exists for this day
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
      stats.alreadyExists++;
      continue;
    }

    // Try to find the call in twilio_call_logs
    // Look for calls within 14 days of the lead date (in case last_contacted is approximate)
    const searchStart = new Date(dayStart);
    searchStart.setDate(searchStart.getDate() - 14);
    const searchEnd = new Date(dayEnd);
    searchEnd.setDate(searchEnd.getDate() + 1);

    const { data: callLogs } = await supabaseAdmin
      .from('twilio_call_logs')
      .select('call_duration, call_status, call_started_at, twilio_call_sid, owner_email')
      .eq('owner_email', agentEmail)
      .eq('to_number', phone)
      .gte('call_started_at', searchStart.toISOString())
      .lt('call_started_at', searchEnd.toISOString())
      .not('call_duration', 'is', null)
      .gt('call_duration', 0)
      .order('call_started_at', { ascending: false })
      .limit(10);

    // Find the call closest to the lead's last_contacted date
    let callLog = callLogs?.find(c => {
      if (!c.call_duration || c.call_duration <= 0) return false;
      const callDate = new Date(c.call_started_at);
      const leadDate = new Date(lead.last_contacted || lead.updated_at || new Date());
      // Prefer calls within 1 day of last_contacted
      const diffDays = Math.abs(callDate.getTime() - leadDate.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays <= 1;
    });

    // If no close match, use the most recent valid call
    if (!callLog) {
      callLog = callLogs?.find(c => c.call_duration && c.call_duration > 0);
    }

    if (!callLog || !callLog.call_duration || callLog.call_duration <= 0) {
      stats.noDuration++;
      if (stats.noDuration <= 10) {
        console.warn(`⚠️ No valid call duration found for ${agentEmail} -> ${phone} (lead_id: ${lead.id}, date: ${leadDate.toLocaleDateString()})`);
      }
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
      source: 'masterlead_backfill_recent',
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
    const dateStr = new Date(eventTimestamp).toLocaleDateString();
    console.log(`✅ Booked: ${name} -> ${phone} (${callDuration}s, ${dateStr}, lead_id: ${lead.id})`);

    if (stats.processed % 50 === 0) {
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

backfillBookedRecent()
  .then(() => {
    console.log('\n✅ Backfill complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
