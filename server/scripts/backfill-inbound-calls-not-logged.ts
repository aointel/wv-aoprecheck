/**
 * Find all inbound calls to 609 from Twilio that are NOT in twilio_call_logs,
 * and insert (log) them. Use for historical backfill so every inbound is in Supabase.
 *
 * Run: npx tsx server/scripts/backfill-inbound-calls-not-logged.ts [days=30] [limit=5000]
 */
import twilio from 'twilio';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from '../hardcoded-config.js';
import { supabaseAdmin } from '../supabase.js';

const INBOUND_609 = '+16096048379';
const BATCH_SIZE = 500;
const DEFAULT_DAYS = 30;
const DEFAULT_LIMIT = 5000;

function normalize10(phone: string | null | undefined): string {
  return String(phone || '').replace(/\D/g, '').slice(-10);
}

async function resolveAssociateId(agentEmail: string): Promise<number | null> {
  if (!supabaseAdmin || !agentEmail || !agentEmail.includes('@')) return null;
  const email = agentEmail.trim().toLowerCase();
  const { data: custCompany } = await supabaseAdmin.from('customers').select('associate_id').eq('company_email', email).maybeSingle();
  if (custCompany?.associate_id != null) return Number(custCompany.associate_id);
  const { data: custPersonal } = await supabaseAdmin.from('customers').select('associate_id').eq('personal_email', email).maybeSingle();
  if (custPersonal?.associate_id != null) return Number(custPersonal.associate_id);
  const { data: producerlist } = await supabaseAdmin.from('producerlist').select('associate_id').eq('company_email', email).maybeSingle();
  if (producerlist?.associate_id != null) return Number(producerlist.associate_id);
  const { data: profileEmail } = await supabaseAdmin.from('agent_profiles').select('agent_associate_id').eq('email', email).maybeSingle();
  if ((profileEmail as any)?.agent_associate_id != null) return Number((profileEmail as any).agent_associate_id);
  const { data: profileAgent } = await supabaseAdmin.from('agent_profiles').select('agent_associate_id').eq('agent_email', email).maybeSingle();
  if ((profileAgent as any)?.agent_associate_id != null) return Number((profileAgent as any).agent_associate_id);
  return null;
}

async function getLeadByPhone(callerPhone: string | null | undefined): Promise<{ lead_id: string; taalk_lead_id: string | null } | null> {
  if (!supabaseAdmin) return null;
  const p10 = normalize10(callerPhone);
  if (p10.length < 10) return null;
  const { data } = await supabaseAdmin
    .from('masterlead')
    .select('id, taalk_lead_id')
    .or(`phone.eq.${p10},phone.eq.+1${p10},phone_number.eq.${p10},phone_number.eq.+1${p10}`)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return { lead_id: String((data as any).id), taalk_lead_id: (data as any).taalk_lead_id ?? null };
}

async function main() {
  const days = parseInt(process.argv[2] || String(DEFAULT_DAYS), 10);
  const limit = parseInt(process.argv[3] || String(DEFAULT_LIMIT), 10);

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error('❌ Twilio not configured.');
    process.exit(1);
  }
  if (!supabaseAdmin) {
    console.error('❌ Supabase admin not configured.');
    process.exit(1);
  }

  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  const after = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const startTimeAfter = after.toISOString().slice(0, 19) + 'Z';

  console.log(`\n📞 Fetch inbound to ${INBOUND_609} from Twilio (last ${days}d), then log any NOT in twilio_call_logs (max ${limit})\n`);

  const calls: { sid: string; from: string | null; to: string | null; status: string; startTime: string; endTime: string | null; duration: number }[] = [];
  let endTimeBefore: string | null = null;

  while (calls.length < limit) {
    const opts: Record<string, unknown> = {
      to: INBOUND_609,
      startTimeAfter,
      limit: BATCH_SIZE,
    };
    if (endTimeBefore) opts.endTimeBefore = endTimeBefore;
    const batch = await client.calls.list(opts as any);
    for (const c of batch) {
      if (calls.length >= limit) break;
      calls.push({
        sid: c.sid,
        from: c.from || null,
        to: c.to || null,
        status: (c.status || '').toLowerCase() || 'unknown',
        startTime: c.startTime ? new Date(c.startTime).toISOString() : new Date().toISOString(),
        endTime: c.endTime ? new Date(c.endTime).toISOString() : null,
        duration: c.duration ?? 0,
      });
    }
    if (batch.length < BATCH_SIZE) break;
    const oldest = batch[batch.length - 1];
    const oldestStart = oldest.startTime ? new Date(oldest.startTime) : null;
    if (!oldestStart) break;
    endTimeBefore = oldestStart.toISOString().slice(0, 19) + 'Z';
  }

  console.log(`   Fetched ${calls.length} calls from Twilio. Checking which are already in twilio_call_logs...`);

  const sids = calls.map((c) => c.sid);
  const existingSids = new Set<string>();
  for (let i = 0; i < sids.length; i += 200) {
    const chunk = sids.slice(i, i + 200);
    const { data } = await supabaseAdmin.from('twilio_call_logs').select('twilio_call_sid').in('twilio_call_sid', chunk);
    for (const r of data || []) existingSids.add((r as any).twilio_call_sid);
  }

  const notLogged = calls.filter((c) => !existingSids.has(c.sid));
  console.log(`   Already in DB: ${existingSids.size}. Not logged (will insert): ${notLogged.length}\n`);

  let inserted = 0;
  let errors = 0;

  for (const c of notLogged) {
    const lead = await getLeadByPhone(c.from);
    const row = {
      twilio_call_sid: c.sid,
      from_number: c.from,
      to_number: c.to,
      call_direction: 'inbound' as const,
      call_status: c.status,
      call_duration: c.duration,
      call_started_at: c.startTime,
      call_ended_at: c.endTime,
      call_source: 'backfill_inbound_not_logged',
      ...(lead ? { lead_id: lead.lead_id, taalk_lead_id: lead.taalk_lead_id } : {}),
    };
    const { error } = await supabaseAdmin.from('twilio_call_logs').upsert(row, { onConflict: 'twilio_call_sid' });
    if (error) {
      errors++;
      if (errors <= 5) console.error('   ❌', c.sid, error.message);
      continue;
    }
    inserted++;
    if (inserted <= 10) console.log(`   ✅ Logged ${c.sid} (${c.from} → ${c.status})`);
  }

  console.log(`\n✅ Done. Inserted ${inserted} previously unlogged inbound calls. Errors: ${errors}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
