/**
 * List which 609 inbound calls each agent TOOK today.
 * Uses: twilio_call_logs.owner_email (set on dequeue), else Twilio child calls (parentCallSid), else masterlead.cn_email.
 *
 * Run: npx tsx server/scripts/list-inbound-calls-by-agent.ts
 */
import twilio from 'twilio';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from '../hardcoded-config';
import { supabaseAdmin } from '../supabase';

const TO_609 = '+16096048379';

function getTodayUTC(): { start: Date; end: Date } {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const start = new Date(`${y}-${m}-${d}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

async function getAgentForInboundCall(
  supabase: NonNullable<typeof supabaseAdmin>,
  twilioClient: ReturnType<typeof twilio>,
  inboundCallSid: string,
  callerFrom: string
): Promise<string | null> {
  const { data: row } = await supabase
    .from('twilio_call_logs')
    .select('owner_email')
    .eq('twilio_call_sid', inboundCallSid)
    .maybeSingle();
  const email = (row as any)?.owner_email?.trim();
  if (email && email.includes('@')) return email;

  try {
    const childCalls = await twilioClient.calls.list({ parentCallSid: inboundCallSid, limit: 5 });
    for (const ch of childCalls) {
      const to = (ch.to || '').trim();
      if (to.toLowerCase().startsWith('client:') && to.includes('@')) {
        return to.replace(/^client:/i, '').trim();
      }
    }
  } catch (_) {}

  if (!supabase || !callerFrom) return null;
  const last10 = callerFrom.replace(/\D/g, '').slice(-10);
  if (last10.length < 10) return null;
  try {
    const { data: rpc } = await supabase.rpc('get_masterlead_by_phone_last10', { last10 });
    const lead = Array.isArray(rpc) && rpc.length ? rpc[0] : null;
    const ce = (lead as any)?.cn_email?.trim();
    if (ce && ce.includes('@')) return ce;
  } catch (_) {}
  const { data: leadRow } = await supabase
    .from('masterlead')
    .select('cn_email')
    .ilike('phone', `%${last10}%`)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const cn = (leadRow as any)?.cn_email?.trim();
  return cn && cn.includes('@') ? cn : null;
}

async function main() {
  const dbOnly = process.argv.includes('--db-only');
  if (!supabaseAdmin) {
    console.error('Supabase not configured');
    process.exit(1);
  }

  const { start, end } = getTodayUTC();
  const startStr = start.toISOString().slice(0, 19);
  const endStr = end.toISOString().slice(0, 19);

  // DB-only: instant list from twilio_call_logs (609 inbounds with owner_email set on dequeue)
  if (dbOnly) {
    const { data: rowsToday, error: errToday } = await supabaseAdmin
      .from('twilio_call_logs')
      .select('twilio_call_sid, from_number, owner_email, call_started_at, call_duration')
      .eq('call_source', 'incomingcall_609')
      .not('owner_email', 'is', null)
      .gte('call_started_at', startStr)
      .lt('call_started_at', endStr)
      .order('call_started_at', { ascending: false })
      .limit(500);
    let rows = rowsToday;
    let label = `today (${start.toISOString().slice(0, 10)})`;
    if (errToday) {
      console.error('DB error:', errToday.message);
      process.exit(1);
    }
    if (!rows?.length) {
      const { data: rowsAny } = await supabaseAdmin
        .from('twilio_call_logs')
        .select('twilio_call_sid, from_number, owner_email, call_started_at, call_duration')
        .eq('call_source', 'incomingcall_609')
        .not('owner_email', 'is', null)
        .order('call_started_at', { ascending: false })
        .limit(200);
      rows = rowsAny ?? [];
      label = 'recent (all time)';
    }
    const byAgent = new Map<string, Array<{ callSid: string; from: string; duration: number; startTime: string }>>();
    for (const r of rows || []) {
      const email = (r as any).owner_email?.trim() || '(unknown)';
      if (!byAgent.has(email)) byAgent.set(email, []);
      byAgent.get(email)!.push({
        callSid: (r as any).twilio_call_sid ?? '',
        from: (r as any).from_number ?? '',
        duration: (r as any).call_duration ?? 0,
        startTime: (r as any).call_started_at ?? '',
      });
    }
    console.log(`\n=== 609 inbound calls taken ${label} (DB) by agent ===\n`);
    console.log(`Total: ${rows?.length ?? 0}\n`);
    const agents = Array.from(byAgent.entries()).sort((a, b) => b[1].length - a[1].length);
    for (const [agentEmail, list] of agents) {
      console.log(`--- ${agentEmail} (${list.length} calls) ---`);
      for (const call of list) {
        console.log(`  ${call.callSid}  From: ${call.from}  ${call.duration}s  ${call.startTime}`);
      }
      console.log('');
    }
    return;
  }

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error('Missing Twilio credentials');
    process.exit(1);
  }

  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  const calls = await client.calls.list({
    to: TO_609,
    startTimeAfter: start,
    startTimeBefore: end,
    limit: 200,
  });

  const taken = calls.filter((c) => c.status === 'completed' && (c.duration == null || c.duration > 0));
  console.log(`Twilio: ${taken.length} taken calls to ${TO_609} today. Resolving agent per call...`);
  const byAgent = new Map<string, Array<{ callSid: string; from: string; duration: number; startTime: string }>>();

  for (let i = 0; i < taken.length; i++) {
    const c = taken[i];
    if (i > 0 && i % 10 === 0) console.log(`  ... ${i}/${taken.length}`);
    const from = (c.from || '').trim();
    const agent = await getAgentForInboundCall(supabaseAdmin, client, c.sid, from);
    const key = agent || '(unknown)';
    if (!byAgent.has(key)) byAgent.set(key, []);
    byAgent.get(key)!.push({
      callSid: c.sid,
      from,
      duration: c.duration ?? 0,
      startTime: c.startTime ? new Date(c.startTime).toISOString() : '',
    });
  }

  console.log(`\n=== 609 inbound calls taken today (UTC ${start.toISOString().slice(0, 10)}) by agent ===\n`);
  console.log(`Total taken: ${taken.length}\n`);

  const agents = Array.from(byAgent.entries()).sort((a, b) => b[1].length - a[1].length);
  for (const [agentEmail, list] of agents) {
    console.log(`--- ${agentEmail} (${list.length} calls) ---`);
    for (const call of list) {
      console.log(`  ${call.callSid}  From: ${call.from}  ${call.duration}s  ${call.startTime}`);
    }
    console.log('');
  }
}

main().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
