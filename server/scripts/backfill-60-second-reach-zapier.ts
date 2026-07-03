import { supabaseAdmin } from '../supabase';

type ReachEventRow = {
  id: number;
  agent_email: string | null;
  lead_id: number | null;
  lead_phone: string | null;
  call_duration: number | null;
  event_timestamp: string;
};

const ZAPIER_REACH_WEBHOOK_URL = 'https://hooks.zapier.com/hooks/catch/2467580/uifcmkd/';

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

  const { data: customerByCompany } = await supabaseAdmin
    .from('customers')
    .select('associate_id')
    .eq('company_email', normalizedEmail)
    .maybeSingle();
  if (customerByCompany?.associate_id != null) return Number(customerByCompany.associate_id);

  const { data: customerByPersonal } = await supabaseAdmin
    .from('customers')
    .select('associate_id')
    .eq('personal_email', normalizedEmail)
    .maybeSingle();
  if (customerByPersonal?.associate_id != null) return Number(customerByPersonal.associate_id);

  const { data: producerlist } = await supabaseAdmin
    .from('producerlist')
    .select('associate_id')
    .eq('company_email', normalizedEmail)
    .maybeSingle();
  if (producerlist?.associate_id != null) return Number(producerlist.associate_id);

  return leadAssociateId || null;
}

async function getLeadByIdOrPhone(leadId: number | null, leadPhone: string | null): Promise<{
  id: number;
  taalk_lead_id: string | null;
  associate_id: number | null;
} | null> {
  if (leadId) {
    const { data } = await supabaseAdmin
      .from('masterlead')
      .select('id, taalk_lead_id, associate_id')
      .eq('id', leadId)
      .maybeSingle();
    if (data) return data as any;
  }

  const cleanPhone = normalizePhone(leadPhone);
  if (!cleanPhone) return null;

  const { data } = await supabaseAdmin
    .from('masterlead')
    .select('id, taalk_lead_id, associate_id, updated_at')
    .or(`phone.eq.${cleanPhone},phone.eq.+1${cleanPhone},phone_number.eq.${cleanPhone},phone_number.eq.+1${cleanPhone}`)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as any) || null;
}

async function fetchReachEvents(daysBack: number, minDurationSeconds: number): Promise<ReachEventRow[]> {
  const end = new Date();
  const start = new Date(end.getTime() - daysBack * 24 * 60 * 60 * 1000);
  const startIso = start.toISOString();
  const endIso = end.toISOString();

  const rows: ReachEventRow[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabaseAdmin
      .from('agent_dial_metrics')
      .select('id,agent_email,lead_id,lead_phone,call_duration,event_timestamp')
      .eq('event_type', 'reach')
      .gte('event_timestamp', startIso)
      .lt('event_timestamp', endIso)
      .not('agent_email', 'is', null)
      .not('call_duration', 'is', null)
      .gte('call_duration', minDurationSeconds)
      .order('event_timestamp', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const batch = (data || []) as ReachEventRow[];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return rows;
}

async function main(): Promise<void> {
  if (!supabaseAdmin) {
    throw new Error('Supabase admin client is not configured.');
  }

  const daysBack = parseNumberArg('days', 7);
  const minDurationSeconds = parseNumberArg('min-duration', 60);
  const batchSize = parseNumberArg('batch-size', 25);
  const delayMs = parseNumberArg('delay-ms', 250);
  const dryRun = hasFlag('dry-run');

  console.log(`🚀 Backfill Zapier reach webhook (>=${minDurationSeconds}s)`);
  console.log(`   days=${daysBack} batchSize=${batchSize} delayMs=${delayMs} dryRun=${dryRun}\n`);

  const rawEvents = await fetchReachEvents(daysBack, minDurationSeconds);
  console.log(`📥 Found ${rawEvents.length} reach events\n`);

  const dedupe = new Set<string>();
  const payloads: Array<{
    lead_id: string;
    taalk_lead_id: string;
    associate_id: number;
    agent_email: string;
    duration: number;
    source: string;
    backfilled: boolean;
    event_timestamp: string;
  }> = [];

  let skippedMissingLead = 0;
  let skippedMissingAssociate = 0;

  for (const row of rawEvents) {
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
      source: 'reach_60s_backfill',
      backfilled: true,
      event_timestamp: row.event_timestamp,
    });
  }

  console.log(`🧮 Ready to send ${payloads.length} unique webhook payloads`);
  console.log(`   skipped (missing lead)=${skippedMissingLead}`);
  console.log(`   skipped (missing associate_id)=${skippedMissingAssociate}\n`);

  if (dryRun) {
    console.log('🧪 Dry run enabled; no webhooks sent.');
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
