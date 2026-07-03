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

async function runBackfill(): Promise<void> {
  const startIso = '2026-02-25T00:00:00.000Z';
  const nowIso = new Date().toISOString();
  console.log('Backfilling agent_dial_metrics from', startIso, 'to', nowIso);

  const metricRows: MetricRow[] = [];
  const pageSize = 1000;

  // 1) Backfill dial + reach from Twilio call logs.
  let twilioFetched = 0;
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
      if (!email || phone.length !== 10 || !ts) continue;

      const answeredOrCompleted = status === 'answered' || status === 'completed';
      const excluded = ['failed', 'busy', 'no-answer', 'canceled'].includes(status) && !answeredOrCompleted;
      const isDial = (duration >= 1 || answeredOrCompleted) && !excluded;
      const isReach = duration >= 55 && answeredOrCompleted;

      if (isDial) {
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
      }

      if (isReach) {
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
      }
    }

    if (rows.length < pageSize) break;
  }

  // 2) Backfill booked from masterlead resolutions updated after 2/25.
  let masterleadFetched = 0;
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
      if (!email || phone.length !== 10 || !ts) continue;
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
    }

    if (rows.length < pageSize) break;
  }

  if (metricRows.length === 0) {
    console.log('No rows to insert.');
    return;
  }

  // 3) Insert in chunks.
  let inserted = 0;
  for (let i = 0; i < metricRows.length; i += 1000) {
    const chunk = metricRows.slice(i, i + 1000);
    const { error } = await supabaseAdmin.from('agent_dial_metrics').insert(chunk);
    if (error) throw error;
    inserted += chunk.length;
  }

  console.log('Twilio rows scanned:', twilioFetched);
  console.log('Masterlead rows scanned:', masterleadFetched);
  console.log('Inserted metric rows:', inserted);

  const { count: sinceCount } = await supabaseAdmin
    .from('agent_dial_metrics')
    .select('*', { count: 'exact', head: true })
    .gte('event_timestamp', startIso);
  console.log('agent_dial_metrics rows since 2026-02-25:', sinceCount || 0);
}

runBackfill()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

