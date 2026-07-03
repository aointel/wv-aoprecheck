import { supabaseAdmin } from '../supabase';

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

type WebhookPayload = {
  lead_id: string;
  taalk_lead_id: string;
  associate_id: number;
  agent_email: string;
  duration: number;
  source: string;
  backfilled: boolean;
  event_timestamp: string;
};

async function resolveLeadForTwilioCall(call: any): Promise<{ id: number; taalk_lead_id: string | null; associate_id: number | null } | null> {
  const meta = (call.metadata && typeof call.metadata === 'object') ? call.metadata : {};
  const directLeadId = meta.lead_id || meta.leadId || meta.taalk_lead_id || meta.taalkLeadId;
  if (directLeadId) {
    const { data } = await supabaseAdmin
      .from('masterlead')
      .select('id, taalk_lead_id, associate_id')
      .or(`id.eq.${directLeadId},taalk_lead_id.eq.${directLeadId}`)
      .maybeSingle();
    if (data) return data as any;
  }

  const metaLeadPhone = String(meta.lead_phone || meta.leadPhone || '').trim();
  if (metaLeadPhone) {
    const lead = await getLeadByIdOrPhone(null, metaLeadPhone);
    if (lead) return lead;
  }

  if (call.parent_call_sid) {
    const { data: parent } = await supabaseAdmin
      .from('twilio_call_logs')
      .select('metadata')
      .eq('twilio_call_sid', call.parent_call_sid)
      .maybeSingle();
    const pMeta = (parent?.metadata && typeof parent.metadata === 'object') ? parent.metadata : {};
    const parentLeadId = pMeta.lead_id || pMeta.leadId || pMeta.taalk_lead_id || pMeta.taalkLeadId;
    if (parentLeadId) {
      const { data } = await supabaseAdmin
        .from('masterlead')
        .select('id, taalk_lead_id, associate_id')
        .or(`id.eq.${parentLeadId},taalk_lead_id.eq.${parentLeadId}`)
        .maybeSingle();
      if (data) return data as any;
    }
    const parentLeadPhone = String(pMeta.lead_phone || pMeta.leadPhone || '').trim();
    if (parentLeadPhone) {
      const lead = await getLeadByIdOrPhone(null, parentLeadPhone);
      if (lead) return lead;
    }
  }

  return getLeadByIdOrPhone(null, String(call.to_number || ''));
}

async function fetch60SecondReachEvents(daysBack: number): Promise<WebhookPayload[]> {
  const end = new Date();
  const start = new Date(end.getTime() - daysBack * 24 * 60 * 60 * 1000);
  const startIso = start.toISOString();
  const endIso = end.toISOString();

  console.log(`📥 Fetching reach events >= 60 seconds from agent_dial_metrics...`);
  
  const rows: any[] = [];
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
      .gte('call_duration', 60)
      .order('event_timestamp', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const batch = (data || []) as any[];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }

  console.log(`   Found ${rows.length} reach events >= 60 seconds from agent_dial_metrics`);

  console.log(`📥 Fetching calls >= 60 seconds from twilio_call_logs...`);
  
  const twilioCalls: any[] = [];
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
      .gte('call_duration', 60)
      .order('call_started_at', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const batch = (data || []) as any[];
    twilioCalls.push(...batch);
    if (batch.length < pageSize) break;
  }

  console.log(`   Found ${twilioCalls.length} calls >= 60 seconds from twilio_call_logs\n`);

  const payloads: WebhookPayload[] = [];
  const dedupe = new Set<string>();
  let skippedMissingLead = 0;
  let skippedMissingAssociate = 0;

  // Process agent_dial_metrics events
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
      source: 'reach_60s_backfill_adm',
      backfilled: true,
      event_timestamp: row.event_timestamp,
    });
  }

  // Process twilio_call_logs calls
  for (const call of twilioCalls) {
    const agentEmail = String(call.owner_email || '').toLowerCase().trim();
    if (!agentEmail) continue;

    const lead = await resolveLeadForTwilioCall(call);
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
      duration: Number(call.call_duration || 0),
      source: 'reach_60s_backfill_twilio',
      backfilled: true,
      event_timestamp: call.call_started_at,
    });
  }

  console.log(`   Prepared ${payloads.length} unique payloads from 60s+ events (${rows.length} from agent_dial_metrics + ${twilioCalls.length} from twilio_call_logs)`);
  console.log(`   Skipped: ${skippedMissingLead} missing lead, ${skippedMissingAssociate} missing associate_id\n`);

  return payloads;
}

async function getCallDurationForLead(leadId: number, agentEmail: string, leadPhone: string | null): Promise<number | null> {
  // Try agent_dial_metrics first
  const normalizedPhone = normalizePhone(leadPhone || '');
  if (normalizedPhone) {
    const { data: metrics } = await supabaseAdmin
      .from('agent_dial_metrics')
      .select('call_duration')
      .eq('lead_id', leadId)
      .eq('agent_email', agentEmail)
      .not('call_duration', 'is', null)
      .gt('call_duration', 0)
      .order('event_timestamp', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (metrics?.call_duration) {
      return Number(metrics.call_duration);
    }

    // Try by phone
    const { data: metricsByPhone } = await supabaseAdmin
      .from('agent_dial_metrics')
      .select('call_duration')
      .eq('lead_phone', normalizedPhone)
      .eq('agent_email', agentEmail)
      .not('call_duration', 'is', null)
      .gt('call_duration', 0)
      .order('event_timestamp', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (metricsByPhone?.call_duration) {
      return Number(metricsByPhone.call_duration);
    }
  }

  // Try twilio_call_logs
  if (normalizedPhone) {
    const { data: twilioCall } = await supabaseAdmin
      .from('twilio_call_logs')
      .select('call_duration')
      .eq('owner_email', agentEmail)
      .eq('call_direction', 'outbound')
      .or(`to_number.eq.${normalizedPhone},to_number.eq.+1${normalizedPhone}`)
      .not('call_duration', 'is', null)
      .gt('call_duration', 0)
      .order('call_started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (twilioCall?.call_duration) {
      return Number(twilioCall.call_duration);
    }
  }

  return null;
}

async function fetchDispositionEvents(daysBack: number): Promise<WebhookPayload[]> {
  const end = new Date();
  const start = new Date(end.getTime() - daysBack * 24 * 60 * 60 * 1000);
  const startIso = start.toISOString();
  const endIso = end.toISOString();

  console.log(`📥 Fetching disposition events (booked, not_interested) >= 45 seconds from ${startIso} to ${endIso}...`);

  // First, get from agent_dial_metrics
  const rows: any[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabaseAdmin
      .from('agent_dial_metrics')
      .select('id,agent_email,lead_id,lead_phone,call_duration,event_timestamp,disposition')
      .in('disposition', ['booked', 'not_interested'])
      .gte('event_timestamp', startIso)
      .lt('event_timestamp', endIso)
      .not('agent_email', 'is', null)
      .not('call_duration', 'is', null)
      .gte('call_duration', 45)
      .order('event_timestamp', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const batch = (data || []) as any[];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }

  console.log(`   Found ${rows.length} disposition events from agent_dial_metrics (booked/not_interested) >= 45 seconds`);

  // Also get from masterlead
  const masterleadRows: any[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabaseAdmin
      .from('masterlead')
      .select('id, taalk_lead_id, cn_email, phone, cnresolution, last_contacted, updated_at')
      .in('cnresolution', ['booked', 'not_interested'])
      .or(`last_contacted.gte.${startIso},updated_at.gte.${startIso}`)
      .or(`last_contacted.lt.${endIso},updated_at.lt.${endIso}`)
      .not('cn_email', 'is', null)
      .neq('cn_email', '')
      .order('last_contacted', { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const batch = (data || []) as any[];
    masterleadRows.push(...batch);
    if (batch.length < pageSize) break;
  }

  console.log(`   Found ${masterleadRows.length} disposition records from masterlead (booked/not_interested)\n`);

  const payloads: WebhookPayload[] = [];
  const dedupe = new Set<string>();
  let skippedMissingLead = 0;
  let skippedMissingAssociate = 0;
  let skippedLowDuration = 0;

  // Process agent_dial_metrics events
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
      source: `disposition_${row.disposition}_backfill_adm`,
      backfilled: true,
      event_timestamp: row.event_timestamp,
    });
  }

  // Process masterlead records - we already have the lead data!
  for (const lead of masterleadRows) {
    const agentEmail = String(lead.cn_email || '').toLowerCase().trim();
    if (!agentEmail) continue;

    // Use taalk_lead_id if available, otherwise use id
    const taalkLeadId = lead.taalk_lead_id ? String(lead.taalk_lead_id).trim() : String(lead.id);
    if (!taalkLeadId) {
      skippedMissingLead += 1;
      continue;
    }

    const associateId = await resolveAssociateId(agentEmail, null);
    if (!associateId) {
      skippedMissingAssociate += 1;
      continue;
    }

    // Get call duration
    const callDuration = await getCallDurationForLead(lead.id, agentEmail, lead.phone);
    if (!callDuration || callDuration < 45) {
      skippedLowDuration += 1;
      continue;
    }

    const dedupeKey = `${agentEmail}:${taalkLeadId}:${associateId}`;
    if (dedupe.has(dedupeKey)) continue;
    dedupe.add(dedupeKey);

    const eventTimestamp = lead.last_contacted || lead.updated_at || new Date().toISOString();

    payloads.push({
      lead_id: taalkLeadId,
      taalk_lead_id: taalkLeadId,
      associate_id: associateId,
      agent_email: agentEmail,
      duration: callDuration,
      source: `disposition_${lead.cnresolution}_backfill_ml`,
      backfilled: true,
      event_timestamp: eventTimestamp,
    });
  }

  console.log(`   Prepared ${payloads.length} unique payloads from disposition events`);
  console.log(`   Skipped: ${skippedMissingLead} missing lead, ${skippedMissingAssociate} missing associate_id, ${skippedLowDuration} low duration\n`);

  return payloads;
}

async function main(): Promise<void> {
  if (!supabaseAdmin) {
    throw new Error('Supabase admin client is not configured.');
  }

  const daysBack = parseNumberArg('days', 14);
  const batchSize = parseNumberArg('batch-size', 25);
  const delayMs = parseNumberArg('delay-ms', 250);
  const dryRun = hasFlag('dry-run');

  console.log(`🚀 Backfill Zapier webhook for 60s+ calls and dispositions (booked/not_interested)`);
  console.log(`   days=${daysBack} batchSize=${batchSize} delayMs=${delayMs} dryRun=${dryRun}\n`);

  // Fetch both types of events
  const [reach60sPayloads, dispositionPayloads] = await Promise.all([
    fetch60SecondReachEvents(daysBack),
    fetchDispositionEvents(daysBack)
  ]);

  // Combine and deduplicate by lead_id + associate_id + agent_email
  const combinedDedupe = new Map<string, WebhookPayload>();
  
  for (const payload of [...reach60sPayloads, ...dispositionPayloads]) {
    const key = `${payload.agent_email}:${payload.lead_id}:${payload.associate_id}`;
    // Keep the one with longer duration if duplicate
    if (!combinedDedupe.has(key) || combinedDedupe.get(key)!.duration < payload.duration) {
      combinedDedupe.set(key, payload);
    }
  }

  const finalPayloads = Array.from(combinedDedupe.values());

  console.log(`🧮 Total unique webhook payloads to send: ${finalPayloads.length}`);
  console.log(`   From 60s+ reach events: ${reach60sPayloads.length}`);
  console.log(`   From disposition events: ${dispositionPayloads.length}`);
  console.log(`   After deduplication: ${finalPayloads.length}\n`);

  if (dryRun) {
    console.log('🧪 Dry run enabled; no webhooks sent.');
    console.log('Sample payloads:');
    console.log('  60s+ reach:', finalPayloads.find(p => p.source.includes('reach_60s')) || null);
    console.log('  Disposition:', finalPayloads.find(p => p.source.includes('disposition')) || null);
    return;
  }

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < finalPayloads.length; i += batchSize) {
    const batch = finalPayloads.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(finalPayloads.length / batchSize);
    console.log(`📦 Sending batch ${batchNum}/${totalBatches} (${batch.length} webhooks)`);
    
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
          if (sent % 50 === 0) {
            console.log(`   ✅ Sent ${sent}/${finalPayloads.length}...`);
          }
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
    if (i + batchSize < finalPayloads.length) {
      await new Promise((resolve) => setTimeout(resolve, Math.max(500, delayMs * 4)));
    }
  }

  console.log('\n✅ Backfill complete');
  console.log(`   sent=${sent}`);
  console.log(`   failed=${failed}`);
  console.log(`   total=${finalPayloads.length}`);
}

main().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
