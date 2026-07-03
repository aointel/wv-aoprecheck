import { supabaseAdmin } from '../supabase';
import fetch from 'node-fetch';

type EventRow = {
  id: number;
  agent_email: string | null;
  lead_id: number | null;
  lead_phone: string | null;
  call_duration: number | null;
  event_timestamp: string;
  event_type: 'reach' | 'booked';
};

const ZAPIER_REACH_WEBHOOK_URL = 'https://hooks.zapier.com/hooks/catch/2467580/uifcmkd/';
const ZAPIER_BOOKED_WEBHOOK_URL = 'https://hooks.zapier.com/hooks/catch/2467580/uifcmkd/';

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

async function fetchEvents(daysBack: number, eventType: 'reach' | 'booked'): Promise<EventRow[]> {
  const end = new Date();
  const start = new Date(end.getTime() - daysBack * 24 * 60 * 60 * 1000);
  const startIso = start.toISOString();
  const endIso = end.toISOString();

  const rows: EventRow[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabaseAdmin
      .from('agent_dial_metrics')
      .select('id,agent_email,lead_id,lead_phone,call_duration,event_timestamp,event_type')
      .eq('event_type', eventType)
      .gte('event_timestamp', startIso)
      .lt('event_timestamp', endIso)
      .not('agent_email', 'is', null)
      .order('event_timestamp', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const batch = (data || []) as EventRow[];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return rows;
}

type WebhookPayload = {
  lead_id: string;
  taalk_lead_id: string;
  associate_id: number;
  agent_email: string;
  duration?: number;
  source: string;
  backfilled: boolean;
  event_timestamp: string;
  event_type: 'reach' | 'booked';
};

async function main(): Promise<void> {
  if (!supabaseAdmin) {
    throw new Error('Supabase admin client is not configured.');
  }

  const daysBack = parseNumberArg('days', 14);
  const batchSize = parseNumberArg('batch-size', 25);
  const delayMs = parseNumberArg('delay-ms', 250);
  const dryRun = hasFlag('dry-run');

  console.log(`🚀 Backfill Zapier webhooks for REACH and BOOKED events`);
  console.log(`   days=${daysBack} batchSize=${batchSize} delayMs=${delayMs} dryRun=${dryRun}\n`);

  // Fetch both reach and booked events
  console.log('📥 Fetching reach events...');
  const reachEvents = await fetchEvents(daysBack, 'reach');
  console.log(`   Found ${reachEvents.length} reach events\n`);

  console.log('📥 Fetching booked events...');
  const bookedEvents = await fetchEvents(daysBack, 'booked');
  console.log(`   Found ${bookedEvents.length} booked events\n`);

  const allEvents = [...reachEvents, ...bookedEvents];
  console.log(`📊 Total events: ${allEvents.length}\n`);

  const dedupe = new Set<string>();
  const reachPayloads: WebhookPayload[] = [];
  const bookedPayloads: WebhookPayload[] = [];

  let skippedMissingLead = 0;
  let skippedMissingAssociate = 0;

  for (const row of allEvents) {
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

    const dedupeKey = `${row.event_type}:${agentEmail}:${taalkLeadId}:${associateId}`;
    if (dedupe.has(dedupeKey)) continue;
    dedupe.add(dedupeKey);

    const payload: WebhookPayload = {
      lead_id: taalkLeadId,
      taalk_lead_id: taalkLeadId,
      associate_id: associateId,
      agent_email: agentEmail,
      duration: row.call_duration || undefined,
      source: `${row.event_type}_backfill_2weeks`,
      backfilled: true,
      event_timestamp: row.event_timestamp,
      event_type: row.event_type,
    };

    if (row.event_type === 'reach') {
      reachPayloads.push(payload);
    } else {
      bookedPayloads.push(payload);
    }
  }

  console.log(`🧮 Ready to send:`);
  console.log(`   ${reachPayloads.length} reach webhook payloads`);
  console.log(`   ${bookedPayloads.length} booked webhook payloads`);
  console.log(`   skipped (missing lead)=${skippedMissingLead}`);
  console.log(`   skipped (missing associate_id)=${skippedMissingAssociate}\n`);

  if (dryRun) {
    console.log('🧪 Dry run enabled; no webhooks sent.');
    console.log('Sample reach payload:', reachPayloads[0] || null);
    console.log('Sample booked payload:', bookedPayloads[0] || null);
    return;
  }

  let reachSent = 0;
  let reachFailed = 0;
  let bookedSent = 0;
  let bookedFailed = 0;

  // Send reach events
  if (reachPayloads.length > 0) {
    console.log(`\n📤 Sending ${reachPayloads.length} REACH webhooks...`);
    for (let i = 0; i < reachPayloads.length; i += batchSize) {
      const batch = reachPayloads.slice(i, i + batchSize);
      console.log(`📦 Reach batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(reachPayloads.length / batchSize)} (${batch.length})`);
      for (let j = 0; j < batch.length; j++) {
        const payload = batch[j];
        try {
          const response = await fetch(ZAPIER_REACH_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (response.ok) {
            reachSent += 1;
          } else {
            reachFailed += 1;
            const body = await response.text().catch(() => '');
            console.error(`❌ Reach webhook failed (${response.status}) lead=${payload.lead_id} agent=${payload.agent_email} ${body.slice(0, 160)}`);
          }
        } catch (error) {
          reachFailed += 1;
          console.error(`❌ Reach webhook error lead=${payload.lead_id} agent=${payload.agent_email}`, error);
        }
        if (j < batch.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
      if (i + batchSize < reachPayloads.length) {
        await new Promise((resolve) => setTimeout(resolve, Math.max(500, delayMs * 4)));
      }
    }
  }

  // Send booked events
  if (bookedPayloads.length > 0) {
    console.log(`\n📤 Sending ${bookedPayloads.length} BOOKED webhooks...`);
    for (let i = 0; i < bookedPayloads.length; i += batchSize) {
      const batch = bookedPayloads.slice(i, i + batchSize);
      console.log(`📦 Booked batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(bookedPayloads.length / batchSize)} (${batch.length})`);
      for (let j = 0; j < batch.length; j++) {
        const payload = batch[j];
        try {
          const response = await fetch(ZAPIER_BOOKED_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (response.ok) {
            bookedSent += 1;
          } else {
            bookedFailed += 1;
            const body = await response.text().catch(() => '');
            console.error(`❌ Booked webhook failed (${response.status}) lead=${payload.lead_id} agent=${payload.agent_email} ${body.slice(0, 160)}`);
          }
        } catch (error) {
          bookedFailed += 1;
          console.error(`❌ Booked webhook error lead=${payload.lead_id} agent=${payload.agent_email}`, error);
        }
        if (j < batch.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
      if (i + batchSize < bookedPayloads.length) {
        await new Promise((resolve) => setTimeout(resolve, Math.max(500, delayMs * 4)));
      }
    }
  }

  console.log('\n✅ Backfill complete');
  console.log(`   REACH: sent=${reachSent} failed=${reachFailed}`);
  console.log(`   BOOKED: sent=${bookedSent} failed=${bookedFailed}`);
  console.log(`   TOTAL: sent=${reachSent + bookedSent} failed=${reachFailed + bookedFailed}`);
}

main().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
