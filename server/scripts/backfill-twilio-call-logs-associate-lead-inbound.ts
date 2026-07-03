/**
 * Backfill twilio_call_logs IN SUPABASE: set associate_id, lead_id, taalk_lead_id
 * for every INBOUND row that has owner_email but missing any of those.
 * This actually writes to the table so you see them in Supabase.
 *
 * Run: npx tsx server/scripts/backfill-twilio-call-logs-associate-lead-inbound.ts [days=30] [limit=2000]
 */
import { supabaseAdmin } from '../supabase.js';

const DEFAULT_DAYS = 30;
const DEFAULT_LIMIT = 2000;

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

  if (!supabaseAdmin) {
    console.error('❌ supabaseAdmin not configured.');
    process.exit(1);
  }

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data: rows, error } = await supabaseAdmin
    .from('twilio_call_logs')
    .select('twilio_call_sid, from_number, owner_email, associate_id, lead_id, taalk_lead_id')
    .eq('call_direction', 'inbound')
    .not('owner_email', 'is', null)
    .gte('call_started_at', since)
    .order('call_started_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('❌ Fetch failed:', error.message);
    process.exit(1);
  }

  const needBackfill = (rows || []).filter(
    (r: any) => r.owner_email && (r.associate_id == null || r.lead_id == null)
  );

  console.log('\n📞 Backfill twilio_call_logs (Supabase): associate_id, lead_id, taalk_lead_id');
  console.log(`   Inbound with owner_email (last ${days}d): ${(rows || []).length}`);
  console.log(`   Missing associate_id or lead_id: ${needBackfill.length}\n`);

  let updated = 0;
  let errs = 0;

  for (const r of needBackfill as any[]) {
    const [associateId, lead] = await Promise.all([
      resolveAssociateId(r.owner_email),
      getLeadByPhone(r.from_number),
    ]);
    const updatePayload: Record<string, unknown> = {};
    if (associateId != null) updatePayload.associate_id = associateId;
    if (lead) {
      updatePayload.lead_id = lead.lead_id;
      updatePayload.taalk_lead_id = lead.taalk_lead_id;
    }
    if (Object.keys(updatePayload).length === 0) continue;

    const { error: upErr } = await supabaseAdmin
      .from('twilio_call_logs')
      .update(updatePayload)
      .eq('twilio_call_sid', r.twilio_call_sid);

    if (upErr) {
      errs++;
      if (errs <= 5) console.error('   ❌', r.twilio_call_sid, upErr.message);
      continue;
    }
    updated++;
    if (updated <= 15) {
      console.log(`   ✅ ${r.twilio_call_sid} owner=${r.owner_email} → associate_id=${associateId ?? '—'} lead_id=${lead?.lead_id ?? '—'} taalk_lead_id=${lead?.taalk_lead_id ?? '—'}`);
    }
  }

  console.log(`\n✅ Done. Updated ${updated} rows in twilio_call_logs (Supabase). Errors: ${errs}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
