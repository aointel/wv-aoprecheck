/**
 * Booked leads from agent_dial_metrics → Zapier (lead_id + associate_id per agent), batched.
 * Queries rows where event_type = 'booked' OR disposition = 'booked' in the lookback window.
 *
 * Run (dry-run, last 14 days):
 *   npx tsx server/scripts/backfill-booked-adm-to-zapier.ts --dry-run
 * Send (default batch 20, 300ms between posts, pause between batches):
 *   npx tsx server/scripts/backfill-booked-adm-to-zapier.ts --days=14 --batch-size=20 --delay-ms=300
 */
import { supabaseAdmin } from '../supabase';

const ZAPIER_REACH_WEBHOOK_URL = 'https://hooks.zapier.com/hooks/catch/2467580/uifcmkd/';

const associateIdCache = new Map<string, number | null>();
const leadByPhoneCache = new Map<string, { id: number; taalk_lead_id: string | null; associate_id: number | null } | null>();
const leadByIdCache = new Map<number, { id: number; taalk_lead_id: string | null; associate_id: number | null } | null>();

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
    const c = associateIdCache.get(normalizedEmail);
    return c != null ? c : leadAssociateId || null;
  }

  const { data: customerByCompany } = await supabaseAdmin!
    .from('customers')
    .select('associate_id')
    .eq('company_email', normalizedEmail)
    .maybeSingle();
  if (customerByCompany?.associate_id != null) {
    const v = Number(customerByCompany.associate_id);
    associateIdCache.set(normalizedEmail, v);
    return v;
  }

  const { data: customerByPersonal } = await supabaseAdmin!
    .from('customers')
    .select('associate_id')
    .eq('personal_email', normalizedEmail)
    .maybeSingle();
  if (customerByPersonal?.associate_id != null) {
    const v = Number(customerByPersonal.associate_id);
    associateIdCache.set(normalizedEmail, v);
    return v;
  }

  const { data: producerlist } = await supabaseAdmin!
    .from('producerlist')
    .select('associate_id')
    .eq('company_email', normalizedEmail)
    .maybeSingle();
  if (producerlist?.associate_id != null) {
    const v = Number(producerlist.associate_id);
    associateIdCache.set(normalizedEmail, v);
    return v;
  }

  associateIdCache.set(normalizedEmail, null);
  return leadAssociateId || null;
}

async function getLeadByIdOrPhone(
  leadId: number | null,
  leadPhone: string | null
): Promise<{ id: number; taalk_lead_id: string | null; associate_id: number | null } | null> {
  if (leadId && leadId > 0) {
    if (leadByIdCache.has(leadId)) {
      const hit = leadByIdCache.get(leadId);
      if (hit) return hit;
    } else {
      const { data } = await supabaseAdmin!
        .from('masterlead')
        .select('id, taalk_lead_id, associate_id')
        .eq('id', leadId)
        .maybeSingle();
      if (data) {
        const row = data as any;
        leadByIdCache.set(leadId, row);
        return row;
      }
    }
  }

  const cleanPhone = normalizePhone(leadPhone);
  if (!cleanPhone) return null;
  if (leadByPhoneCache.has(cleanPhone)) {
    const hit = leadByPhoneCache.get(cleanPhone);
    return hit === undefined ? null : hit;
  }

  const { data } = await supabaseAdmin!
    .from('masterlead')
    .select('id, taalk_lead_id, associate_id, updated_at')
    .or(`phone.eq.${cleanPhone},phone.eq.+1${cleanPhone},phone_number.eq.${cleanPhone},phone_number.eq.+1${cleanPhone}`)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const row = (data as any) || null;
  leadByPhoneCache.set(cleanPhone, row);
  return row;
}

type WebhookPayload = {
  lead_id: string;
  taalk_lead_id: string;
  associate_id: number;
  agent_email: string;
  duration: number;
  source: string;
  backfilled: boolean;
  event_timestamp: string;
  disposition: string;
};

async function fetchBookedAdmRows(daysBack: number, minDurationSeconds: number): Promise<any[]> {
  const end = new Date();
  const start = new Date(end.getTime() - daysBack * 24 * 60 * 60 * 1000);
  const startIso = start.toISOString();
  const endIso = end.toISOString();

  console.log(
    `\n📥 agent_dial_metrics: booked (event_type=booked OR disposition=booked), ${startIso.slice(0, 10)} → ${endIso.slice(0, 10)}, call_duration >= ${minDurationSeconds}s\n`
  );

  const rows: any[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    let q = supabaseAdmin!
      .from('agent_dial_metrics')
      .select('id,agent_email,lead_id,lead_phone,call_duration,event_timestamp,disposition,event_type')
      .gte('event_timestamp', startIso)
      .lt('event_timestamp', endIso)
      .not('agent_email', 'is', null)
      .neq('agent_email', '')
      .or('event_type.eq.booked,disposition.eq.booked')
      .order('event_timestamp', { ascending: true })
      .range(from, from + pageSize - 1);

    if (minDurationSeconds > 0) {
      q = q.not('call_duration', 'is', null).gte('call_duration', minDurationSeconds);
    }

    const { data, error } = await q;
    if (error) throw error;
    const batch = (data || []) as any[];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }

  console.log(`   Raw rows (booked in ADM): ${rows.length}`);
  return rows;
}

/** One row per agent + lead identity (prefer latest event_timestamp). */
function dedupeAdmRows(rows: any[]): any[] {
  const map = new Map<string, any>();
  for (const row of rows) {
    const agent = String(row.agent_email || '').toLowerCase().trim();
    const lid = row.lead_id != null ? String(row.lead_id) : '';
    const ph = normalizePhone(row.lead_phone);
    const key = `${agent}|${lid}|${ph}`;
    const prev = map.get(key);
    if (!prev || String(row.event_timestamp) > String(prev.event_timestamp)) {
      map.set(key, row);
    }
  }
  const out = Array.from(map.values());
  console.log(`   After dedupe (agent+lead_id+phone): ${out.length}`);
  return out;
}

async function buildPayloads(rows: any[]): Promise<{
  payloads: WebhookPayload[];
  skippedMissingLead: number;
  skippedMissingAssociate: number;
}> {
  const payloads: WebhookPayload[] = [];
  const dedupe = new Set<string>();
  let skippedMissingLead = 0;
  let skippedMissingAssociate = 0;

  for (const row of rows) {
    const agentEmail = String(row.agent_email || '').toLowerCase().trim();
    if (!agentEmail) continue;

    const lead = await getLeadByIdOrPhone(row.lead_id || null, row.lead_phone || null);
    if (!lead) {
      skippedMissingLead += 1;
      continue;
    }

    const taalkLeadId = String(lead.taalk_lead_id || '').trim() || String(lead.id);
    const associateId = await resolveAssociateId(agentEmail, lead.associate_id);
    if (!associateId) {
      skippedMissingAssociate += 1;
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
      duration: Number(row.call_duration || 0),
      source: 'agent_dial_metrics_booked_backfill',
      backfilled: true,
      event_timestamp: row.event_timestamp,
      disposition: String(row.disposition || row.event_type || 'booked'),
    });
  }

  return { payloads, skippedMissingLead, skippedMissingAssociate };
}

async function main(): Promise<void> {
  if (!supabaseAdmin) {
    throw new Error('Supabase admin client is not configured.');
  }

  const daysBack = parseNumberArg('days', 14);
  const minDurationSeconds = parseNumberArg('min-duration', 45);
  const batchSize = parseNumberArg('batch-size', 20);
  const delayMs = parseNumberArg('delay-ms', 300);
  const dryRun = hasFlag('dry-run');

  console.log(`🚀 Booked (agent_dial_metrics) → Zapier, batched`);
  console.log(`   days=${daysBack} minDuration=${minDurationSeconds}s batchSize=${batchSize} delayMs=${delayMs} dryRun=${dryRun}`);

  const rows = await fetchBookedAdmRows(daysBack, minDurationSeconds);
  const deduped = dedupeAdmRows(rows);
  const { payloads, skippedMissingLead, skippedMissingAssociate } = await buildPayloads(deduped);

  console.log(`\n🧮 Unique webhook payloads (one per agent + lead): ${payloads.length}`);
  console.log(`   skipped missing masterlead match: ${skippedMissingLead}`);
  console.log(`   skipped missing associate_id: ${skippedMissingAssociate}\n`);

  if (dryRun) {
    console.log('🧪 Dry run — no webhooks sent.');
    if (payloads[0]) console.log('Sample:', { ...payloads[0], disposition: payloads[0].disposition });
    return;
  }

  let sent = 0;
  let failed = 0;
  const totalBatches = Math.ceil(payloads.length / batchSize) || 0;

  for (let i = 0; i < payloads.length; i += batchSize) {
    const batch = payloads.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    console.log(`📦 Batch ${batchNum}/${totalBatches} (${batch.length} POSTs)`);

    for (let j = 0; j < batch.length; j++) {
      const payload = batch[j];
      const { disposition: _d, ...body } = payload;
      try {
        const response = await fetch(ZAPIER_REACH_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (response.ok) {
          sent += 1;
        } else {
          failed += 1;
          const text = await response.text().catch(() => '');
          console.error(
            `❌ Zapier ${response.status} lead=${payload.lead_id} agent=${payload.agent_email} ${text.slice(0, 120)}`
          );
        }
      } catch (e) {
        failed += 1;
        console.error(`❌ Zapier error lead=${payload.lead_id}`, e);
      }
      if (j < batch.length - 1) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
    if (i + batchSize < payloads.length) {
      await new Promise((r) => setTimeout(r, Math.max(800, delayMs * 3)));
    }
  }

  console.log(`\n✅ Done sent=${sent} failed=${failed} total=${payloads.length}`);
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
