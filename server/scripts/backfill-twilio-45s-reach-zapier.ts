import { supabaseAdmin } from '../supabase';

type TwilioCallRow = {
  twilio_call_sid: string;
  owner_email: string | null;
  to_number: string | null;
  call_duration: number | null;
  call_started_at: string;
  metadata?: any;
  parent_call_sid?: string | null;
};

const ZAPIER_REACH_WEBHOOK_URL = 'https://hooks.zapier.com/hooks/catch/2467580/uifcmkd/';
const associateIdCache = new Map<string, number | null>();
const leadByPhoneCache = new Map<string, { id: number; taalk_lead_id: string | null; associate_id: number | null } | null>();
const leadByIdCache = new Map<string, { id: number; taalk_lead_id: string | null; associate_id: number | null } | null>();
const parentMetaCache = new Map<string, any>();

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

function normalizePhone(raw: string | null | undefined): string {
  return String(raw || '').replace(/\D/g, '').slice(-10);
}

async function resolveAssociateId(agentEmail: string, leadAssociateId?: number | null): Promise<number | null> {
  const normalizedEmail = String(agentEmail || '').toLowerCase().trim();
  if (!normalizedEmail) return leadAssociateId || null;
  if (associateIdCache.has(normalizedEmail)) {
    const cached = associateIdCache.get(normalizedEmail);
    return cached != null ? cached : (leadAssociateId || null);
  }

  const { data: customerCompany } = await supabaseAdmin
    .from('customers')
    .select('associate_id')
    .eq('company_email', normalizedEmail)
    .maybeSingle();
  if (customerCompany?.associate_id != null) {
    const val = Number(customerCompany.associate_id);
    associateIdCache.set(normalizedEmail, val);
    return val;
  }

  const { data: customerPersonal } = await supabaseAdmin
    .from('customers')
    .select('associate_id')
    .eq('personal_email', normalizedEmail)
    .maybeSingle();
  if (customerPersonal?.associate_id != null) {
    const val = Number(customerPersonal.associate_id);
    associateIdCache.set(normalizedEmail, val);
    return val;
  }

  const { data: producerlist } = await supabaseAdmin
    .from('producerlist')
    .select('associate_id')
    .eq('company_email', normalizedEmail)
    .maybeSingle();
  if (producerlist?.associate_id != null) {
    const val = Number(producerlist.associate_id);
    associateIdCache.set(normalizedEmail, val);
    return val;
  }

  associateIdCache.set(normalizedEmail, null);
  return leadAssociateId || null;
}

async function getLeadByPhone(phone: string): Promise<{ id: number; taalk_lead_id: string | null; associate_id: number | null } | null> {
  const clean = normalizePhone(phone);
  if (!clean) return null;
  if (leadByPhoneCache.has(clean)) return leadByPhoneCache.get(clean) || null;
  const raw = String(phone || '').trim();
  const variants = Array.from(new Set([raw, clean, `+1${clean}`, `1${clean}`].filter(Boolean)));
  for (const v of variants) {
    const { data } = await supabaseAdmin
      .from('masterlead')
      .select('id, taalk_lead_id, associate_id, updated_at')
      .or(`phone.eq.${v},phone_number.eq.${v}`)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      const lead = data as any;
      leadByPhoneCache.set(clean, lead);
      return lead;
    }
  }
  leadByPhoneCache.set(clean, null);
  return null;
}

async function getLeadByIdOrTaalk(leadId: string | number | null | undefined): Promise<{ id: number; taalk_lead_id: string | null; associate_id: number | null } | null> {
  const raw = String(leadId ?? '').trim();
  if (!raw) return null;
  if (leadByIdCache.has(raw)) return leadByIdCache.get(raw) || null;
  const asNumber = Number(raw);
  if (Number.isFinite(asNumber) && asNumber > 0) {
    const numericKey = `id:${asNumber}`;
    if (leadByIdCache.has(numericKey)) return leadByIdCache.get(numericKey) || null;
    const { data } = await supabaseAdmin
      .from('masterlead')
      .select('id, taalk_lead_id, associate_id')
      .eq('id', asNumber)
      .maybeSingle();
    if (data) {
      const lead = data as any;
      leadByIdCache.set(raw, lead);
      leadByIdCache.set(numericKey, lead);
      return lead;
    }
  }
  const { data } = await supabaseAdmin
    .from('masterlead')
    .select('id, taalk_lead_id, associate_id')
    .eq('taalk_lead_id', raw)
    .maybeSingle();
  const out = (data as any) || null;
  leadByIdCache.set(raw, out);
  return out;
}

async function resolveLeadForCall(call: TwilioCallRow): Promise<{ id: number; taalk_lead_id: string | null; associate_id: number | null } | null> {
  const meta = (call.metadata && typeof call.metadata === 'object') ? call.metadata : {};
  const directLeadId = meta.lead_id || meta.leadId || meta.taalk_lead_id || meta.taalkLeadId;
  if (directLeadId) {
    const byId = await getLeadByIdOrTaalk(directLeadId);
    if (byId) return byId;
  }

  const metaLeadPhone = String(meta.lead_phone || meta.leadPhone || '').trim();
  if (metaLeadPhone) {
    const byMetaPhone = await getLeadByPhone(metaLeadPhone);
    if (byMetaPhone) return byMetaPhone;
  }

  if (call.parent_call_sid) {
    let pMeta: any = {};
    const parentSid = String(call.parent_call_sid || '').trim();
    if (parentSid) {
      if (parentMetaCache.has(parentSid)) {
        pMeta = parentMetaCache.get(parentSid) || {};
      } else {
        const { data: parent } = await supabaseAdmin
          .from('twilio_call_logs')
          .select('metadata')
          .eq('twilio_call_sid', parentSid)
          .maybeSingle();
        pMeta = (parent?.metadata && typeof parent.metadata === 'object') ? parent.metadata : {};
        parentMetaCache.set(parentSid, pMeta);
      }
    }
    const parentLeadId = pMeta.lead_id || pMeta.leadId || pMeta.taalk_lead_id || pMeta.taalkLeadId;
    if (parentLeadId) {
      const byParentId = await getLeadByIdOrTaalk(parentLeadId);
      if (byParentId) return byParentId;
    }
    const parentLeadPhone = String(pMeta.lead_phone || pMeta.leadPhone || '').trim();
    if (parentLeadPhone) {
      const byParentPhone = await getLeadByPhone(parentLeadPhone);
      if (byParentPhone) return byParentPhone;
    }
  }

  return getLeadByPhone(String(call.to_number || ''));
}

async function fetchQualifiedCalls(daysBack: number, minDurationSeconds: number): Promise<TwilioCallRow[]> {
  const end = new Date();
  const start = new Date(end.getTime() - daysBack * 24 * 60 * 60 * 1000);
  const startIso = start.toISOString();
  const endIso = end.toISOString();

  const allRows: TwilioCallRow[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabaseAdmin
      .from('twilio_call_logs')
      .select('twilio_call_sid,owner_email,to_number,call_duration,call_started_at,metadata,parent_call_sid')
      .eq('call_direction', 'outbound')
      .gte('call_started_at', startIso)
      .lt('call_started_at', endIso)
      .not('owner_email', 'is', null)
      .neq('owner_email', '')
      .not('call_duration', 'is', null)
      .gte('call_duration', minDurationSeconds)
      .order('call_started_at', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const rows = (data || []) as TwilioCallRow[];
    allRows.push(...rows);
    if (rows.length < pageSize) break;
  }
  return allRows;
}

async function main(): Promise<void> {
  if (!supabaseAdmin) throw new Error('Supabase admin client is not configured');

  const daysBack = parseNumberArg('days', 7);
  const minDurationSeconds = parseNumberArg('min-duration', 45);
  const batchSize = parseNumberArg('batch-size', 25);
  const delayMs = parseNumberArg('delay-ms', 250);
  const dryRun = hasFlag('dry-run');

  console.log(`🚀 Twilio logs -> Zapier backfill (>=${minDurationSeconds}s)`);
  console.log(`   days=${daysBack} batchSize=${batchSize} delayMs=${delayMs} dryRun=${dryRun}\n`);

  const calls = await fetchQualifiedCalls(daysBack, minDurationSeconds);
  console.log(`📥 Found ${calls.length} qualifying outbound Twilio calls\n`);

  const payloads: Array<{
    lead_id: string;
    taalk_lead_id: string;
    associate_id: number;
    agent_email: string;
    duration: number;
    source: string;
    backfilled: boolean;
    call_sid: string;
    call_started_at: string;
  }> = [];
  let missingLead = 0;
  let missingAssociate = 0;
  const dedupe = new Set<string>();

  for (const call of calls) {
    const agentEmail = String(call.owner_email || '').toLowerCase().trim();
    const lead = await resolveLeadForCall(call);
    if (!lead) {
      missingLead += 1;
      continue;
    }
    const taalkLeadId = String(lead.taalk_lead_id || '').trim() || String(lead.id);
    const associateId = await resolveAssociateId(agentEmail, lead.associate_id);
    if (!associateId) {
      missingAssociate += 1;
      continue;
    }
    const dedupeKey = `${agentEmail}:${taalkLeadId}:${associateId}`;
    if (dedupe.has(dedupeKey)) continue;
    dedupe.add(dedupeKey);

    payloads.push({
      lead_id: taalkLeadId,
      taalk_lead_id: taalkLeadId,
      associate_id: associateId,
      agent_email: agentEmail,
      duration: Number(call.call_duration || 0),
      source: 'twilio_logs_45s_backfill',
      backfilled: true,
      call_sid: String(call.twilio_call_sid || ''),
      call_started_at: call.call_started_at,
    });
  }

  console.log(`🧮 Prepared ${payloads.length} unique webhook payloads`);
  console.log(`   skipped missing lead=${missingLead}`);
  console.log(`   skipped missing associate_id=${missingAssociate}\n`);

  if (dryRun) {
    console.log('🧪 Dry run enabled, no webhooks sent');
    console.log('Sample payload:', payloads[0] || null);
    return;
  }

  let sent = 0;
  let failed = 0;
  for (let i = 0; i < payloads.length; i += batchSize) {
    const batch = payloads.slice(i, i + batchSize);
    console.log(`📦 Sending batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(payloads.length / batchSize)} (${batch.length})`);
    for (let j = 0; j < batch.length; j++) {
      const payload = batch[j];
      try {
        const response = await fetch(ZAPIER_REACH_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (response.ok) {
          sent += 1;
        } else {
          failed += 1;
          const body = await response.text().catch(() => '');
          console.error(`❌ Zapier failed (${response.status}) lead=${payload.lead_id} agent=${payload.agent_email} ${body.slice(0, 160)}`);
        }
      } catch (error) {
        failed += 1;
        console.error(`❌ Zapier error lead=${payload.lead_id} agent=${payload.agent_email}`, error);
      }
      if (j < batch.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
    if (i + batchSize < payloads.length) {
      await new Promise((resolve) => setTimeout(resolve, Math.max(500, delayMs * 4)));
    }
  }

  console.log('\n✅ Backfill complete');
  console.log(`   sent=${sent}`);
  console.log(`   failed=${failed}`);
}

main().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
