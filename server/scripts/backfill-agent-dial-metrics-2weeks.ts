import { supabaseAdmin } from '../supabase';

type MetricRow = {
  agent_email: string;
  agent_name: string | null;
  lead_id: number | null;
  lead_phone: string;
  lead_name: string | null;
  lead_state: string | null;
  event_type: 'dial' | 'reach' | 'booked';
  event_timestamp: string;
  call_duration: number | null;
  call_status: string | null;
  disposition: string | null;
  call_sid: string | null;
  source: string;
  notes: string | null;
};

function normalizePhone(raw: string | null | undefined): string {
  return String(raw || '').replace(/\D/g, '').slice(-10);
}

function parseNumberArg(name: string, fallback: number): number {
  const prefix = `--${name}=`;
  const raw = process.argv.find((a) => a.startsWith(prefix));
  if (!raw) return fallback;
  const value = Number(raw.slice(prefix.length));
  return Number.isFinite(value) ? value : fallback;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function checkExistingEvent(
  agentEmail: string,
  leadPhone: string,
  eventType: 'dial' | 'reach' | 'booked',
  timestamp: string,
  toleranceSeconds: number = 60
): Promise<boolean> {
  const ts = new Date(timestamp);
  const start = new Date(ts.getTime() - toleranceSeconds * 1000).toISOString();
  const end = new Date(ts.getTime() + toleranceSeconds * 1000).toISOString();

  const { count } = await supabaseAdmin
    .from('agent_dial_metrics')
    .select('*', { count: 'exact', head: true })
    .eq('agent_email', agentEmail.toLowerCase().trim())
    .eq('lead_phone', leadPhone)
    .eq('event_type', eventType)
    .gte('event_timestamp', start)
    .lt('event_timestamp', end);

  return (count || 0) > 0;
}

async function runBackfill(): Promise<void> {
  const daysBack = parseNumberArg('days', 14);
  const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
  const startIso = startDate.toISOString();
  const nowIso = new Date().toISOString();
  const dryRun = hasFlag('dry-run');

  console.log(`🚀 Backfilling agent_dial_metrics for last ${daysBack} days`);
  console.log(`   From: ${startIso}`);
  console.log(`   To: ${nowIso}`);
  console.log(`   Dry run: ${dryRun}\n`);

  const metricRows: MetricRow[] = [];
  const pageSize = 1000;
  let skippedExisting = 0;
  let skippedInvalid = 0;

  // 1) Backfill dial + reach from Twilio call logs
  console.log('📥 Fetching Twilio call logs...');
  let twilioFetched = 0;
  let twilioDialAdded = 0;
  let twilioReachAdded = 0;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabaseAdmin
      .from('twilio_call_logs')
      .select('owner_email,to_number,call_duration,call_status,call_started_at,twilio_call_sid')
      .eq('call_direction', 'outbound')
      .gte('call_started_at', startIso)
      .lt('call_started_at', nowIso)
      .not('owner_email', 'is', null)
      .neq('owner_email', '')
      .not('to_number', 'is', null)
      .neq('to_number', '')
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const rows = data || [];
    twilioFetched += rows.length;

    for (const row of rows) {
      const email = String((row as any).owner_email || '').toLowerCase().trim();
      const phone = normalizePhone((row as any).to_number);
      const status = String((row as any).call_status || '').toLowerCase();
      const duration = Number((row as any).call_duration || 0);
      const ts = String((row as any).call_started_at || '');
      const sid = String((row as any).twilio_call_sid || '').trim() || null;
      
      if (!email || phone.length !== 10 || !ts) {
        skippedInvalid++;
        continue;
      }

      const answeredOrCompleted = status === 'answered' || status === 'completed';
      const excluded = ['failed', 'busy', 'no-answer', 'canceled'].includes(status) && !answeredOrCompleted;
      const isDial = (duration >= 1 || answeredOrCompleted) && !excluded;
      const isReach = duration >= 55 && answeredOrCompleted;

      if (isDial) {
        const exists = await checkExistingEvent(email, phone, 'dial', ts);
        if (!exists) {
          metricRows.push({
            agent_email: email,
            agent_name: null,
            lead_id: null,
            lead_phone: phone,
            lead_name: null,
            lead_state: null,
            event_type: 'dial',
            event_timestamp: ts,
            call_duration: duration > 0 ? duration : null,
            call_status: status || null,
            disposition: null,
            call_sid: sid,
            source: 'backfill_twilio_outbound',
            notes: null,
          });
          twilioDialAdded++;
        } else {
          skippedExisting++;
        }
      }

      if (isReach) {
        const exists = await checkExistingEvent(email, phone, 'reach', ts);
        if (!exists) {
          metricRows.push({
            agent_email: email,
            agent_name: null,
            lead_id: null,
            lead_phone: phone,
            lead_name: null,
            lead_state: null,
            event_type: 'reach',
            event_timestamp: ts,
            call_duration: duration > 0 ? duration : null,
            call_status: status || null,
            disposition: 'connected',
            call_sid: sid,
            source: 'backfill_twilio_outbound',
            notes: null,
          });
          twilioReachAdded++;
        } else {
          skippedExisting++;
        }
      }
    }

    if (rows.length < pageSize) break;
  }

  console.log(`   Scanned: ${twilioFetched} Twilio calls`);
  console.log(`   Added: ${twilioDialAdded} dial events, ${twilioReachAdded} reach events`);
  console.log(`   Skipped: ${skippedExisting} existing, ${skippedInvalid} invalid\n`);

  // 2) Backfill booked from masterlead
  console.log('📥 Fetching masterlead booked resolutions...');
  let masterleadFetched = 0;
  let masterleadBookedAdded = 0;
  skippedExisting = 0;
  skippedInvalid = 0;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabaseAdmin
      .from('masterlead')
      .select('id,cn_email,phone,first_name,last_name,state,cnresolution,updated_at')
      .gte('updated_at', startIso)
      .lt('updated_at', nowIso)
      .in('cnresolution', ['booked', 'appointment', 'appointment_set', 'set_appointment', 'qualified', 'callback_scheduled', 'meet', 'sale'])
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const rows = data || [];
    masterleadFetched += rows.length;

    for (const row of rows) {
      const email = String((row as any).cn_email || '').toLowerCase().trim();
      const phone = normalizePhone((row as any).phone);
      const ts = String((row as any).updated_at || '');
      
      if (!email || phone.length !== 10 || !ts) {
        skippedInvalid++;
        continue;
      }

      const exists = await checkExistingEvent(email, phone, 'booked', ts);
      if (!exists) {
        const first = String((row as any).first_name || '').trim();
        const last = String((row as any).last_name || '').trim();
        const name = `${first} ${last}`.trim() || null;
        const disp = String((row as any).cnresolution || 'booked').toLowerCase();
        
        metricRows.push({
          agent_email: email,
          agent_name: null,
          lead_id: Number((row as any).id || 0) || null,
          lead_phone: phone,
          lead_name: name,
          lead_state: String((row as any).state || '').trim().toUpperCase() || null,
          event_type: 'booked',
          event_timestamp: ts,
          call_duration: null,
          call_status: null,
          disposition: disp,
          call_sid: null,
          source: 'backfill_masterlead_resolution',
          notes: 'Backfilled from masterlead.cnresolution',
        });
        masterleadBookedAdded++;
      } else {
        skippedExisting++;
      }
    }

    if (rows.length < pageSize) break;
  }

  console.log(`   Scanned: ${masterleadFetched} masterlead rows`);
  console.log(`   Added: ${masterleadBookedAdded} booked events`);
  console.log(`   Skipped: ${skippedExisting} existing, ${skippedInvalid} invalid\n`);

  if (metricRows.length === 0) {
    console.log('✅ No new rows to insert. Data is already complete!');
    return;
  }

  console.log(`📊 Total new rows to insert: ${metricRows.length}`);
  console.log(`   DIAL: ${twilioDialAdded}`);
  console.log(`   REACH: ${twilioReachAdded}`);
  console.log(`   BOOKED: ${masterleadBookedAdded}\n`);

  if (dryRun) {
    console.log('🧪 Dry run enabled; no rows inserted.');
    console.log('Sample rows:', metricRows.slice(0, 3));
    return;
  }

  // 3) Insert in chunks
  console.log('💾 Inserting rows...');
  let inserted = 0;
  for (let i = 0; i < metricRows.length; i += 1000) {
    const chunk = metricRows.slice(i, i + 1000);
    const { error } = await supabaseAdmin.from('agent_dial_metrics').insert(chunk);
    if (error) {
      console.error(`❌ Error inserting chunk ${i}-${i + chunk.length}:`, error);
      throw error;
    }
    inserted += chunk.length;
    console.log(`   Inserted ${inserted}/${metricRows.length} rows...`);
  }

  console.log('\n✅ Backfill complete!');
  console.log(`   Inserted: ${inserted} new metric rows`);
  console.log(`   Twilio: ${twilioDialAdded} dial, ${twilioReachAdded} reach`);
  console.log(`   Masterlead: ${masterleadBookedAdded} booked`);

  // Verify final counts
  const { count: finalDialCount } = await supabaseAdmin
    .from('agent_dial_metrics')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'dial')
    .gte('event_timestamp', startIso);

  const { count: finalReachCount } = await supabaseAdmin
    .from('agent_dial_metrics')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'reach')
    .gte('event_timestamp', startIso);

  const { count: finalBookedCount } = await supabaseAdmin
    .from('agent_dial_metrics')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'booked')
    .gte('event_timestamp', startIso);

  console.log(`\n📊 Final counts (since ${startIso}):`);
  console.log(`   DIAL: ${finalDialCount || 0}`);
  console.log(`   REACH: ${finalReachCount || 0}`);
  console.log(`   BOOKED: ${finalBookedCount || 0}`);
}

runBackfill()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Backfill failed:', err);
    process.exit(1);
  });
