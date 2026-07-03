import { supabaseAdmin } from '../supabase';

type AgentAgg = {
  dialPhones: Map<string, number>;
  reachedPhones: Set<string>;
  bookedPhones: Set<string>;
  instantPhones: Set<string>;
  connects: number;
};

function getPstDayUtcRange(now = new Date()): { startIso: string; endIso: string } {
  const dateParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const year = dateParts.find((p) => p.type === 'year')?.value || '1970';
  const month = dateParts.find((p) => p.type === 'month')?.value || '01';
  const day = dateParts.find((p) => p.type === 'day')?.value || '01';

  const tzName = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    timeZoneName: 'shortOffset',
  }).formatToParts(now).find((p) => p.type === 'timeZoneName')?.value || 'GMT-8';
  const m = tzName.match(/GMT([+-]\d{1,2})/);
  const hours = Number(m?.[1] || -8);
  const sign = hours >= 0 ? '+' : '-';
  const hh = String(Math.abs(hours)).padStart(2, '0');
  const offset = `${sign}${hh}:00`;

  const start = new Date(`${year}-${month}-${day}T00:00:00${offset}`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

async function recalcLiveCallBoardNow(): Promise<void> {
  const { startIso, endIso } = getPstDayUtcRange();
  console.log('Recalculating live_call_boardt for PST day window:', startIso, '->', endIso);

  const byAgent = new Map<string, AgentAgg>();
  const pageSize = 1000;

  let fetchedTwilio = 0;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabaseAdmin
      .from('twilio_call_logs')
      .select('owner_email,to_number,call_status,call_duration,call_started_at')
      .eq('call_direction', 'outbound')
      .gte('call_started_at', startIso)
      .lt('call_started_at', endIso)
      .not('owner_email', 'is', null)
      .neq('owner_email', '')
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const rows = data || [];
    fetchedTwilio += rows.length;

    for (const row of rows) {
      const email = String((row as any).owner_email || '').toLowerCase().trim();
      if (!email) continue;
      if (!byAgent.has(email)) {
        byAgent.set(email, {
          dialPhones: new Map<string, number>(),
          reachedPhones: new Set<string>(),
          bookedPhones: new Set<string>(),
          instantPhones: new Set<string>(),
          connects: 0,
        });
      }
      const agg = byAgent.get(email)!;
      const phone = String((row as any).to_number || '').replace(/\D/g, '').slice(-10);
      const status = String((row as any).call_status || '').toLowerCase();
      const duration = Number((row as any).call_duration || 0);
      const callTs = new Date(String((row as any).call_started_at || '')).getTime();

      if (phone.length === 10) {
        // Match dashboard logic: distinct phone with 5-min redial dedupe
        const previousTs = agg.dialPhones.get(phone);
        if (!previousTs || callTs - previousTs >= 5 * 60 * 1000) {
          agg.dialPhones.set(phone, callTs);
        }
        if (duration >= 55 && (status === 'answered' || status === 'completed')) {
          agg.reachedPhones.add(phone);
        }
        if (duration >= 600 && (status === 'answered' || status === 'completed')) {
          agg.instantPhones.add(phone);
        }
      }
    }

    if (rows.length < pageSize) break;
  }

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabaseAdmin
      .from('agent_dial_metrics')
      .select('agent_email,event_type,lead_phone')
      .eq('event_type', 'booked')
      .gte('event_timestamp', startIso)
      .lt('event_timestamp', endIso)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const rows = data || [];
    for (const row of rows) {
      const email = String((row as any).agent_email || '').toLowerCase().trim();
      const phone = String((row as any).lead_phone || '').replace(/\D/g, '').slice(-10);
      if (!email || phone.length !== 10) continue;
      if (!byAgent.has(email)) {
        byAgent.set(email, {
          dialPhones: new Map<string, number>(),
          reachedPhones: new Set<string>(),
          bookedPhones: new Set<string>(),
          instantPhones: new Set<string>(),
          connects: 0,
        });
      }
      byAgent.get(email)!.bookedPhones.add(phone);
    }
    if (rows.length < pageSize) break;
  }

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabaseAdmin
      .from('vdp_calls')
      .select('company_email,updated_at')
      .gte('updated_at', startIso)
      .lt('updated_at', endIso)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const rows = data || [];
    for (const row of rows) {
      const email = String((row as any).company_email || '').toLowerCase().trim();
      if (!email) continue;
      if (!byAgent.has(email)) {
        byAgent.set(email, {
          dialPhones: new Map<string, number>(),
          reachedPhones: new Set<string>(),
          bookedPhones: new Set<string>(),
          instantPhones: new Set<string>(),
          connects: 0,
        });
      }
      byAgent.get(email)!.connects += 1;
    }
    if (rows.length < pageSize) break;
  }

  const nowIso = new Date().toISOString();
  const upserts = [...byAgent.entries()].map(([email, agg]) => ({
    agent_email: email,
    today_dialed: agg.dialPhones.size,
    today_reached: agg.reachedPhones.size,
    today_booked: agg.bookedPhones.size,
    today_instant_presentation: agg.instantPhones.size,
    today_connects: agg.connects,
    updated_at: nowIso,
  }));

  const { error: resetError } = await supabaseAdmin
    .from('live_call_boardt')
    .update({
      today_dialed: 0,
      today_reached: 0,
      today_booked: 0,
      today_instant_presentation: 0,
      today_connects: 0,
      updated_at: nowIso,
    })
    .neq('agent_email', '');
  if (resetError) throw resetError;

  for (let i = 0; i < upserts.length; i += 500) {
    const { error } = await supabaseAdmin
      .from('live_call_boardt')
      .upsert(upserts.slice(i, i + 500), { onConflict: 'agent_email' });
    if (error) throw error;
  }

  const { count: activeCount } = await supabaseAdmin
    .from('live_call_boardt')
    .select('*', { count: 'exact', head: true })
    .or('today_dialed.gt.0,today_reached.gt.0,today_booked.gt.0,today_instant_presentation.gt.0,today_connects.gt.0');

  console.log('Twilio rows processed:', fetchedTwilio);
  console.log('Agents recalculated:', upserts.length);
  console.log('Active rows:', activeCount || 0);
}

recalcLiveCallBoardNow()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

