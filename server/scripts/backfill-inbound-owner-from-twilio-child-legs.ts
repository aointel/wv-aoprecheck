/**
 * Backfill owner_email, associate_id, lead_id, taalk_lead_id for inbound calls we have but never got from webhook.
 * Fetches child leg from Twilio (agent), resolves associate_id from agent email, lead/taalk_lead_id from caller phone.
 *
 * Run: npx tsx server/scripts/backfill-inbound-owner-from-twilio-child-legs.ts [days=7] [limit=500]
 */
import twilio from 'twilio';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from '../hardcoded-config.js';
import { supabaseAdmin } from '../supabase.js';

const DEFAULT_DAYS = 7;
const DEFAULT_LIMIT = 500;

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

/** One run of the backfill. Used by cron/scheduler and by CLI. */
export async function runInboundOwnerBackfill(days: number, limit: number): Promise<{ updated: number; skipped: number; errors: number }> {
  if (!supabaseAdmin || !TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    return { updated: 0, skipped: 0, errors: 0 };
  }

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data: rows, error } = await supabaseAdmin
    .from('twilio_call_logs')
    .select('twilio_call_sid, from_number, call_status, owner_email, call_started_at')
    .eq('call_direction', 'inbound')
    .gte('call_started_at', since)
    .or('owner_email.is.null,owner_email.eq.')
    .order('call_started_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('❌ Fetch failed:', error.message);
    return { updated: 0, skipped: 0, errors: 1 };
  }

  const list = (rows || []) as { twilio_call_sid: string; from_number: string | null; call_started_at?: string }[];

  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  let updated = 0;
  let skipped = 0;
  let errs = 0;

  function extractAgentIdentity(leg: any): string | null {
    const to = String(leg.to || '').trim();
    const from = String(leg.from || '').trim();
    for (const raw of [to, from]) {
      if (raw.toLowerCase().startsWith('client:')) {
        const identity = raw.slice(7).trim();
        return identity && identity.includes('@') ? identity : null;
      }
    }
    return null;
  }

  for (let idx = 0; idx < list.length; idx++) {
    const r = list[idx];
    try {
      // 1) Find other leg: children of this call
      let childCalls = await client.calls.list({ parentCallSid: r.twilio_call_sid, limit: 20 });
      let agentLeg = childCalls.find((leg: any) => extractAgentIdentity(leg));
      // 2) If no children, this call might BE the child — try parent
      if (!agentLeg) {
        const ourCall = await client.calls(r.twilio_call_sid).fetch();
        const parentSid = (ourCall as any).parentCallSid ?? (ourCall as any).parent_call_sid;
        if (parentSid) {
          const parentCall = await client.calls(parentSid).fetch();
          const identity = extractAgentIdentity(parentCall);
          if (identity) agentLeg = { ...parentCall, to: (parentCall as any).to, from: (parentCall as any).from };
        }
      }
      // 3) TaskRouter doesn't set parent/child on inbound — find worker leg by time: list all calls in window, find one to/from client:
      if (!agentLeg && (r as any).call_started_at) {
        const inboundStart = new Date((r as any).call_started_at);
        const after = new Date(inboundStart.getTime() - 30 * 1000).toISOString().slice(0, 19) + 'Z';
        const before = new Date(inboundStart.getTime() + 4 * 60 * 1000).toISOString().slice(0, 19) + 'Z';
        const windowCalls = await client.calls.list({ startTimeAfter: after, startTimeBefore: before, limit: 100 });
        for (const w of windowCalls) {
          if (w.sid === r.twilio_call_sid) continue;
          const identity = extractAgentIdentity(w);
          if (identity) {
            agentLeg = w;
            break;
          }
        }
      }
      if (!agentLeg) {
        skipped++;
        continue;
      }
      const identity = extractAgentIdentity(agentLeg);
      if (!identity) {
        skipped++;
        continue;
      }
      const duration = (agentLeg as any).duration != null ? parseInt(String((agentLeg as any).duration), 10) : null;
      // Use identity as owner_email (already extracted)
      const [associateId, lead] = await Promise.all([
        resolveAssociateId(identity),
        getLeadByPhone(r.from_number),
      ]);
      const updatePayload: Record<string, unknown> = {
        owner_email: identity,
        ...(duration != null ? { call_duration: duration } : {}),
        ...(associateId != null ? { associate_id: associateId } : {}),
        ...(lead ? { lead_id: lead.lead_id, taalk_lead_id: lead.taalk_lead_id } : {}),
      };
      const { error: upErr } = await supabaseAdmin
        .from('twilio_call_logs')
        .update(updatePayload)
        .eq('twilio_call_sid', r.twilio_call_sid);
      if (upErr) {
        errs++;
        continue;
      }
      updated++;
      if (updated <= 20) console.log(`   ✅ ${r.twilio_call_sid} → ${identity}${associateId != null ? ` associate_id=${associateId}` : ''}${lead ? ` lead_id=${lead.lead_id}` : ''}`);
    } catch (e) {
      errs++;
    }
  }

  return { updated, skipped, errors: errs };
}

async function main() {
  const days = parseInt(process.argv[2] || String(DEFAULT_DAYS), 10);
  const limit = parseInt(process.argv[3] || String(DEFAULT_LIMIT), 10);
  console.log(`\n📞 Backfill owner_email, associate_id, lead_id, taalk_lead_id (last ${days} days, limit ${limit})\n`);
  const result = await runInboundOwnerBackfill(days, limit);
  console.log(`\n✅ Done. Updated: ${result.updated}, Skipped: ${result.skipped}, Errors: ${result.errors}\n`);
}

const isRunAsScript = process.argv[1]?.includes('backfill-inbound-owner-from-twilio-child-legs');
if (isRunAsScript) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
