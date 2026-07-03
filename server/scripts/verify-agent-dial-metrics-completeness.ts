import { supabaseAdmin } from '../supabase';

function normalizePhone(raw: string | null | undefined): string {
  return String(raw || '').replace(/\D/g, '').slice(-10);
}

async function verifyCompleteness(daysBack: number = 14): Promise<void> {
  if (!supabaseAdmin) {
    throw new Error('Supabase admin client is not configured.');
  }

  const end = new Date();
  const start = new Date(end.getTime() - daysBack * 24 * 60 * 60 * 1000);
  const startIso = start.toISOString();
  const endIso = end.toISOString();

  console.log(`🔍 Verifying agent_dial_metrics completeness for last ${daysBack} days`);
  console.log(`   From: ${startIso}`);
  console.log(`   To: ${endIso}\n`);

  // 1. Count events in agent_dial_metrics
  console.log('📊 Counting events in agent_dial_metrics...');
  const { count: dialCount } = await supabaseAdmin
    .from('agent_dial_metrics')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'dial')
    .gte('event_timestamp', startIso)
    .lt('event_timestamp', endIso);

  const { count: reachCount } = await supabaseAdmin
    .from('agent_dial_metrics')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'reach')
    .gte('event_timestamp', startIso)
    .lt('event_timestamp', endIso);

  const { count: bookedCount } = await supabaseAdmin
    .from('agent_dial_metrics')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'booked')
    .gte('event_timestamp', startIso)
    .lt('event_timestamp', endIso);

  console.log(`   DIAL events: ${dialCount || 0}`);
  console.log(`   REACH events: ${reachCount || 0}`);
  console.log(`   BOOKED events: ${bookedCount || 0}\n`);

  // 2. Count potential events from source tables
  console.log('📊 Counting potential events from source tables...');

  // Count dial/reach from Twilio call logs
  let twilioDialCount = 0;
  let twilioReachCount = 0;
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabaseAdmin
      .from('twilio_call_logs')
      .select('call_duration,call_status,call_started_at')
      .eq('call_direction', 'outbound')
      .gte('call_started_at', startIso)
      .lt('call_started_at', endIso)
      .not('owner_email', 'is', null)
      .not('to_number', 'is', null)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const rows = data || [];
    for (const row of rows) {
      const duration = Number((row as any).call_duration || 0);
      const status = String((row as any).call_status || '').toLowerCase();
      const answeredOrCompleted = status === 'answered' || status === 'completed';
      if (duration >= 1 || answeredOrCompleted) twilioDialCount++;
      if (duration >= 55 && answeredOrCompleted) twilioReachCount++;
    }
    if (rows.length < pageSize) break;
  }

  // Count booked from masterlead
  const { count: masterleadBookedCount } = await supabaseAdmin
    .from('masterlead')
    .select('*', { count: 'exact', head: true })
    .in('cnresolution', ['booked', 'appointment', 'appointment_set', 'set_appointment', 'qualified', 'callback_scheduled', 'meet', 'sale'])
    .gte('updated_at', startIso)
    .lt('updated_at', endIso);

  console.log(`   Twilio DIAL potential: ${twilioDialCount}`);
  console.log(`   Twilio REACH potential: ${twilioReachCount}`);
  console.log(`   Masterlead BOOKED potential: ${masterleadBookedCount || 0}\n`);

  // 3. Compare and report gaps
  console.log('📈 Comparison:');
  const dialGap = twilioDialCount - (dialCount || 0);
  const reachGap = twilioReachCount - (reachCount || 0);
  const bookedGap = (masterleadBookedCount || 0) - (bookedCount || 0);

  console.log(`   DIAL gap: ${dialGap > 0 ? `❌ Missing ${dialGap} events` : '✅ Complete'}`);
  console.log(`   REACH gap: ${reachGap > 0 ? `❌ Missing ${reachGap} events` : '✅ Complete'}`);
  console.log(`   BOOKED gap: ${bookedGap > 0 ? `❌ Missing ${bookedGap} events` : '✅ Complete'}\n`);

  // 4. Check for specific missing data patterns
  console.log('🔍 Checking for missing data patterns...');

  // Find Twilio calls that don't have corresponding dial events
  let missingDialCount = 0;
  const sampleMissingDials: any[] = [];
  for (let from = 0; from < 1000 && sampleMissingDials.length < 10; from += pageSize) {
    const { data } = await supabaseAdmin
      .from('twilio_call_logs')
      .select('owner_email,to_number,call_started_at,call_duration,call_status')
      .eq('call_direction', 'outbound')
      .gte('call_started_at', startIso)
      .lt('call_started_at', endIso)
      .not('owner_email', 'is', null)
      .not('to_number', 'is', null)
      .range(from, from + pageSize - 1);
    if (!data || data.length === 0) break;
    for (const row of data) {
      const email = String((row as any).owner_email || '').toLowerCase().trim();
      const phone = normalizePhone((row as any).to_number);
      const ts = String((row as any).call_started_at || '');
      if (!email || phone.length !== 10 || !ts) continue;
      const { count } = await supabaseAdmin
        .from('agent_dial_metrics')
        .select('*', { count: 'exact', head: true })
        .eq('agent_email', email)
        .eq('lead_phone', phone)
        .eq('event_type', 'dial')
        .gte('event_timestamp', new Date(new Date(ts).getTime() - 60000).toISOString())
        .lt('event_timestamp', new Date(new Date(ts).getTime() + 60000).toISOString());
      if ((count || 0) === 0) {
        missingDialCount++;
        if (sampleMissingDials.length < 10) {
          sampleMissingDials.push({ email, phone, timestamp: ts });
        }
      }
    }
  }

  if (missingDialCount > 0) {
    console.log(`   ⚠️  Found ${missingDialCount} Twilio calls without dial events (sampled first 10):`);
    sampleMissingDials.forEach(m => {
      console.log(`      ${m.email} -> ${m.phone} at ${m.timestamp}`);
    });
  } else {
    console.log(`   ✅ All sampled Twilio calls have dial events`);
  }

  // Find masterlead booked that don't have booked events
  let missingBookedCount = 0;
  const sampleMissingBooked: any[] = [];
  for (let from = 0; from < 1000 && sampleMissingBooked.length < 10; from += pageSize) {
    const { data } = await supabaseAdmin
      .from('masterlead')
      .select('id,cn_email,phone,updated_at,cnresolution')
      .in('cnresolution', ['booked', 'appointment', 'appointment_set', 'set_appointment', 'qualified', 'callback_scheduled', 'meet', 'sale'])
      .gte('updated_at', startIso)
      .lt('updated_at', endIso)
      .range(from, from + pageSize - 1);
    if (!data || data.length === 0) break;
    for (const row of data) {
      const email = String((row as any).cn_email || '').toLowerCase().trim();
      const phone = normalizePhone((row as any).phone);
      const ts = String((row as any).updated_at || '');
      if (!email || phone.length !== 10 || !ts) continue;
      const { count } = await supabaseAdmin
        .from('agent_dial_metrics')
        .select('*', { count: 'exact', head: true })
        .eq('agent_email', email)
        .eq('lead_phone', phone)
        .eq('event_type', 'booked')
        .gte('event_timestamp', new Date(new Date(ts).getTime() - 60000).toISOString())
        .lt('event_timestamp', new Date(new Date(ts).getTime() + 60000).toISOString());
      if ((count || 0) === 0) {
        missingBookedCount++;
        if (sampleMissingBooked.length < 10) {
          sampleMissingBooked.push({ email, phone, timestamp: ts, resolution: (row as any).cnresolution });
        }
      }
    }
  }

  if (missingBookedCount > 0) {
    console.log(`   ⚠️  Found ${missingBookedCount} masterlead booked without booked events (sampled first 10):`);
    sampleMissingBooked.forEach(m => {
      console.log(`      ${m.email} -> ${m.phone} (${m.resolution}) at ${m.timestamp}`);
    });
  } else {
    console.log(`   ✅ All sampled masterlead booked have booked events`);
  }

  console.log('\n✅ Verification complete!');
  console.log(`\n📋 Summary:`);
  console.log(`   DIAL: ${dialCount || 0} / ${twilioDialCount} (${dialGap > 0 ? `Missing ${dialGap}` : 'Complete'})`);
  console.log(`   REACH: ${reachCount || 0} / ${twilioReachCount} (${reachGap > 0 ? `Missing ${reachGap}` : 'Complete'})`);
  console.log(`   BOOKED: ${bookedCount || 0} / ${masterleadBookedCount || 0} (${bookedGap > 0 ? `Missing ${bookedGap}` : 'Complete'})`);

  if (dialGap > 0 || reachGap > 0 || bookedGap > 0) {
    console.log(`\n⚠️  Data gaps detected! Run backfill script to fix.`);
    process.exit(1);
  } else {
    console.log(`\n✅ All data appears complete!`);
  }
}

const daysBack = process.argv.includes('--days') 
  ? Number(process.argv[process.argv.indexOf('--days') + 1]) || 14
  : 14;

verifyCompleteness(daysBack).catch((error) => {
  console.error('❌ Verification failed:', error);
  process.exit(1);
});
