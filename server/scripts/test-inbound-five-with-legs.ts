/**
 * Test the full flow on 5 inbound calls that have a 2nd leg: Twilio child → agent identity →
 * resolve associate_id, get lead/taalk_lead_id by caller phone → update row.
 *
 * Run: npx tsx server/scripts/test-inbound-five-with-legs.ts
 */
import twilio from 'twilio';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from '../hardcoded-config.js';
import { supabaseAdmin } from '../supabase.js';

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
  if (!supabaseAdmin || !TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error('❌ Need supabaseAdmin and Twilio.');
    process.exit(1);
  }

  const { data: rows, error } = await supabaseAdmin
    .from('twilio_call_logs')
    .select('twilio_call_sid, from_number, owner_email, associate_id, lead_id, taalk_lead_id')
    .eq('call_direction', 'inbound')
    .eq('call_status', 'completed')
    .not('owner_email', 'is', null)
    .order('call_started_at', { ascending: false })
    .limit(5);

  if (error || !rows?.length) {
    console.error('❌ No inbound completed rows with owner_email:', error?.message || 'none found');
    process.exit(1);
  }

  console.log('\n🧪 Test inbound 2nd-leg flow on 5 calls\n');
  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

  for (const r of rows as any[]) {
    const sid = r.twilio_call_sid;
    const from = r.from_number;
    console.log(`--- ${sid} (from ${from}) ---`);
    console.log('  BEFORE:', { owner_email: r.owner_email, associate_id: r.associate_id, lead_id: r.lead_id, taalk_lead_id: r.taalk_lead_id });

    const childCalls = await client.calls.list({ parentCallSid: sid, limit: 5 });
    if (childCalls.length > 0) {
      console.log('  Twilio child legs:', childCalls.length, '→', childCalls.map((leg: any) => ({ to: leg.to, from: leg.from })));
    } else {
      console.log('  Twilio child legs: 0 (parentCallSid may not return TaskRouter worker leg)');
    }
    const agentLeg = childCalls.find((leg: any) => {
      const to = String(leg.to || '').trim();
      const fromLeg = String(leg.from || '').trim();
      return to.toLowerCase().startsWith('client:') || fromLeg.toLowerCase().startsWith('client:');
    });
    if (!agentLeg) {
      console.log('  SKIP: no client: child leg from Twilio. Testing associate_id/lead lookup using existing owner_email...');
      const identity = (r.owner_email || '').trim();
      if (identity && identity.includes('@')) {
        const [associateId, lead] = await Promise.all([
          resolveAssociateId(identity),
          getLeadByPhone(from),
        ]);
        console.log('  Lookups from owner_email:', { associate_id: associateId ?? '—', lead_id: lead?.lead_id ?? '—', taalk_lead_id: lead?.taalk_lead_id ?? '—' });
        const updatePayload: Record<string, unknown> = {
          ...(associateId != null ? { associate_id: associateId } : {}),
          ...(lead ? { lead_id: lead.lead_id, taalk_lead_id: lead.taalk_lead_id } : {}),
        };
        if (Object.keys(updatePayload).length > 0) {
          const { error: upErr } = await supabaseAdmin.from('twilio_call_logs').update(updatePayload).eq('twilio_call_sid', sid);
          if (!upErr) {
            const { data: after } = await supabaseAdmin.from('twilio_call_logs').select('owner_email, associate_id, lead_id, taalk_lead_id').eq('twilio_call_sid', sid).single();
            console.log('  AFTER (associate_id/lead backfill):', after || '—');
          } else console.log('  UPDATE FAILED:', upErr.message);
        }
      }
      console.log('');
      continue;
    }
    const raw = String((agentLeg as any).to || (agentLeg as any).from || '').trim();
    const identity = raw.toLowerCase().startsWith('client:') ? raw.slice(7).trim() : raw;
    if (!identity || !identity.includes('@')) {
      console.log('  SKIP: no email in child leg\n');
      continue;
    }

    const [associateId, lead] = await Promise.all([
      resolveAssociateId(identity),
      getLeadByPhone(from),
    ]);
    console.log('  Twilio child →', identity, '| associate_id:', associateId ?? '—', '| lead:', lead ? `${lead.lead_id} / ${lead.taalk_lead_id ?? '—'}` : '—');

    const updatePayload: Record<string, unknown> = {
      owner_email: identity,
      ...(associateId != null ? { associate_id: associateId } : {}),
      ...(lead ? { lead_id: lead.lead_id, taalk_lead_id: lead.taalk_lead_id } : {}),
    };
    const { error: upErr } = await supabaseAdmin
      .from('twilio_call_logs')
      .update(updatePayload)
      .eq('twilio_call_sid', sid);
    if (upErr) {
      console.log('  UPDATE FAILED:', upErr.message, '\n');
      continue;
    }

    const { data: after } = await supabaseAdmin
      .from('twilio_call_logs')
      .select('owner_email, associate_id, lead_id, taalk_lead_id')
      .eq('twilio_call_sid', sid)
      .single();
    console.log('  AFTER:', after || '—');
    console.log('');
  }

  console.log('✅ Done.\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
