/**
 * Find today's inbound 609 calls that were TAKEN (completed, duration > 0) via Twilio API.
 * Look up caller in masterlead for taalk_lead_id and cn_email (agent who had the lead when they picked up).
 * Resolve associate_id for that agent, send to Zapier. Dedupes by (taalk_lead_id, associate_id).
 * (We don't use twilio_call_logs for agent — 609 inbounds weren't all logged. Going forward they are:
 * /incomingcall logs each inbound, and on dequeue we set owner_email on that row.)
 *
 * Run: npx tsx server/scripts/send-todays-inbound-taken-to-zapier.ts
 *      npx tsx server/scripts/send-todays-inbound-taken-to-zapier.ts --dry-run   (no POSTs)
 */
import twilio from 'twilio';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from '../hardcoded-config';
import { supabaseAdmin } from '../supabase';

const TO_609 = '+16096048379';
const ZAPIER_WEBHOOK_URL = 'https://hooks.zapier.com/hooks/catch/2467580/uifcmkd/';

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

type LeadRow = Record<string, unknown>;

async function fetchLeadForCaller(callerLast10: string): Promise<LeadRow | null> {
  if (!supabaseAdmin || callerLast10.length < 10) return null;
  try {
    const { data: rpcRows, error: rpcErr } = await supabaseAdmin.rpc('get_masterlead_by_phone_last10', { last10: callerLast10 });
    if (!rpcErr && rpcRows && Array.isArray(rpcRows) && rpcRows.length > 0) {
      return rpcRows[0] as LeadRow;
    }
  } catch (_) {}
  const { data: leadRow } = await supabaseAdmin
    .from('masterlead')
    .select('id, taalk_lead_id, cn_email, first_name, last_name, phone')
    .ilike('phone', `%${callerLast10}%`)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return leadRow ?? null;
}

async function resolveAssociateId(agentEmail: string | null | undefined): Promise<string | number | null> {
  if (!supabaseAdmin || !agentEmail || !agentEmail.includes('@')) return null;
  const email = agentEmail.trim().toLowerCase();
  try {
    const { data: custCompany } = await supabaseAdmin
      .from('customers')
      .select('associate_id')
      .ilike('company_email', email)
      .maybeSingle();
    if (custCompany?.associate_id != null) return custCompany.associate_id;

    const { data: custPersonal } = await supabaseAdmin
      .from('customers')
      .select('associate_id')
      .ilike('personal_email', email)
      .maybeSingle();
    if (custPersonal?.associate_id != null) return custPersonal.associate_id;

    const { data: profileEmail } = await supabaseAdmin
      .from('agent_profiles')
      .select('agent_associate_id')
      .ilike('email', email)
      .maybeSingle();
    if (profileEmail?.agent_associate_id != null) return profileEmail.agent_associate_id;

    const { data: profileAgentEmail } = await supabaseAdmin
      .from('agent_profiles')
      .select('agent_associate_id')
      .ilike('agent_email', email)
      .maybeSingle();
    if (profileAgentEmail?.agent_associate_id != null) return profileAgentEmail.agent_associate_id;

    const { data: hierarchy } = await supabaseAdmin
      .from('agent_hierarchy')
      .select('agent_associate_id')
      .ilike('agent_email', email)
      .limit(1)
      .maybeSingle();
    if (hierarchy?.agent_associate_id != null) return hierarchy.agent_associate_id;

    const { data: mgaRga } = await supabaseAdmin
      .from('mga_rga_directory')
      .select('associate_id')
      .ilike('email', email)
      .maybeSingle();
    if (mgaRga?.associate_id != null) return mgaRga.associate_id;

    return null;
  } catch (_) {
    return null;
  }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  if (dryRun) console.log('\n--- DRY RUN (no webhooks will be sent) ---\n');

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error('Missing Twilio credentials');
    process.exit(1);
  }
  if (!supabaseAdmin) {
    console.error('Supabase admin not configured');
    process.exit(1);
  }

  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  const { start, end } = getTodayUTC();
  const calls = await client.calls.list({
    to: TO_609,
    startTimeAfter: start,
    startTimeBefore: end,
    limit: 200,
  });

  const taken = calls.filter((c) => c.status === 'completed' && (c.duration == null || c.duration > 0));
  console.log(`\n=== Today's inbound 609 taken calls (UTC ${start.toISOString().slice(0, 10)}) ===\n`);
  console.log(`Total taken (completed, duration > 0): ${taken.length}`);

  const sent = new Set<string>();
  let sentCount = 0;
  let skippedNoAgent = 0;
  let skippedNoLead = 0;
  let skippedNoTaalkId = 0;
  let skippedNoAssociateId = 0;
  let skippedDup = 0;

  for (const c of calls) {
    if (c.status !== 'completed' || (c.duration != null && c.duration <= 0)) continue;
    const from = (c.from || '').trim();
    const callerLast10 = from.replace(/\D/g, '').slice(-10);
    if (callerLast10.length < 10) continue;

    const leadRow = await fetchLeadForCaller(callerLast10);
    if (!leadRow) {
      skippedNoLead++;
      continue;
    }
    const cnEmail = (leadRow as any).cn_email ? String((leadRow as any).cn_email).trim() : null;
    const agentEmail = cnEmail && cnEmail.includes('@') ? cnEmail : null;
    if (!agentEmail) {
      skippedNoAgent++;
      continue;
    }

    const taalkLeadId = (leadRow.taalk_lead_id != null && String(leadRow.taalk_lead_id).trim()) ? String(leadRow.taalk_lead_id).trim() : null;
    if (!taalkLeadId) {
      skippedNoTaalkId++;
      continue;
    }

    const associateId = await resolveAssociateId(agentEmail);
    if (associateId == null) {
      skippedNoAssociateId++;
      continue;
    }

    const dedupeKey = `${taalkLeadId}|${associateId}`;
    if (sent.has(dedupeKey)) {
      skippedDup++;
      continue;
    }
    sent.add(dedupeKey);

    const payload = {
      lead_id: taalkLeadId,
      associate_id: associateId,
      event: 'inbound_picked_up_backfill',
    };
    if (dryRun) {
      console.log(`[DRY RUN] Would send: lead_id=${taalkLeadId} associate_id=${associateId} agent=${agentEmail} call=${c.sid} From=${from}`);
      sentCount++;
      continue;
    }
    try {
      const res = await fetch(ZAPIER_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        console.log(`Sent: lead_id=${taalkLeadId} associate_id=${associateId} agent=${agentEmail}`);
        sentCount++;
      } else {
        console.warn(`Zapier failed ${res.status} for lead_id=${taalkLeadId} associate_id=${associateId}`);
      }
    } catch (err: any) {
      console.warn(`Zapier error for lead_id=${taalkLeadId}:`, err?.message);
    }
  }

  console.log('\n--- Summary ---');
  console.log(`Sent to Zapier: ${sentCount}`);
  console.log(`Skipped (no cn_email on lead): ${skippedNoAgent}`);
  console.log(`Skipped (no masterlead row): ${skippedNoLead}`);
  console.log(`Skipped (no taalk_lead_id): ${skippedNoTaalkId}`);
  console.log(`Skipped (no associate_id for agent): ${skippedNoAssociateId}`);
  console.log(`Skipped (duplicate lead+agent pair): ${skippedDup}`);
}

main().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
