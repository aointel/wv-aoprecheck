/**
 * Sync inbound calls (to 609) from Twilio API into twilio_call_logs every 5 minutes.
 * Fetches by time window (last 10 min) so we log every inbound call, not just "top 100".
 */
import twilio from 'twilio';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from './hardcoded-config.js';
import { supabaseAdmin } from './supabase.js';

/** Inbound Gold numbers — calls TO these numbers are inbound/TaskRouter. */
const INBOUND_NUMBERS = ['+16096048379', '+16095473687'] as const;
const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
/** Fetch calls that started in the last 10 min (overlap so we don't miss any). */
const WINDOW_MINUTES = 10;
const LIMIT_PER_BATCH = 500;

let intervalId: ReturnType<typeof setInterval> | null = null;

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
  const { data } = await masterleadClient.from('masterlead')
    .select('id, taalk_lead_id')
    .or(`phone.eq.${p10},phone.eq.+1${p10},phone_number.eq.${p10},phone_number.eq.+1${p10}`)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return { lead_id: String((data as any).id), taalk_lead_id: (data as any).taalk_lead_id ?? null };
}

async function syncInboundCallsFromTwilio(): Promise<{ count: number; errors: number }> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) return { count: 0, errors: 0 };
  if (!supabaseAdmin) return { count: 0, errors: 0 };
  try {
    const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    const after = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000);
    const startTimeAfter = after.toISOString().slice(0, 19) + 'Z';

    const calls: Awaited<ReturnType<typeof client.calls.list>> = [];
    for (const inboundNumber of INBOUND_NUMBERS) {
      let endTimeBefore: string | null = null;
      while (true) {
        const opts: Record<string, unknown> = {
          to: inboundNumber,
          startTimeAfter,
          limit: LIMIT_PER_BATCH,
        };
        if (endTimeBefore) opts.endTimeBefore = endTimeBefore;
        const batch = await client.calls.list(opts as any);
        calls.push(...batch);
        if (batch.length < LIMIT_PER_BATCH) break;
        const oldest = batch[batch.length - 1];
        const oldestStart = oldest.startTime ? new Date(oldest.startTime) : null;
        if (!oldestStart) break;
        endTimeBefore = oldestStart.toISOString().slice(0, 19) + 'Z';
      }
    }

    let errors = 0;
    for (const c of calls) {
      const callStatus = (c.status || '').toLowerCase() || 'unknown';
      const callStartedAt = c.startTime ? new Date(c.startTime).toISOString() : new Date().toISOString();
      const callEndedAt = c.endTime ? new Date(c.endTime).toISOString() : null;
      const callDuration = c.duration ?? 0;

      const { data: existing } = await supabaseAdmin
        .from('twilio_call_logs')
        .select('owner_email, call_source, associate_id, lead_id, taalk_lead_id')
        .eq('twilio_call_sid', c.sid)
        .maybeSingle();

      const isAgentAccepted =
        (existing as any)?.owner_email ||
        (existing as any)?.call_source === 'taskrouter_inbound' ||
        (existing as any)?.call_source === 'incomingcall_609';

      if (isAgentAccepted) {
        const updatePayload: Record<string, unknown> = {
          call_status: callStatus,
          call_duration: callDuration,
          call_ended_at: callEndedAt,
          call_started_at: callStartedAt,
        };
        const ownerEmail = (existing as any)?.owner_email;
        const needsAssociateOrLead =
          (ownerEmail && (existing as any)?.associate_id == null) ||
          (existing as any)?.lead_id == null;
        if (needsAssociateOrLead && ownerEmail && ownerEmail.includes('@')) {
          const [associateId, lead] = await Promise.all([
            resolveAssociateId(ownerEmail),
            getLeadByPhone(c.from),
          ]);
          if (associateId != null) updatePayload.associate_id = associateId;
          if (lead) {
            updatePayload.lead_id = lead.lead_id;
            updatePayload.taalk_lead_id = lead.taalk_lead_id;
          }
        }
        const { error } = await supabaseAdmin
          .from('twilio_call_logs')
          .update(updatePayload)
          .eq('twilio_call_sid', c.sid);
        if (error) errors++;
        continue;
      }

      const lead = await getLeadByPhone(c.from);
      const row = {
        twilio_call_sid: c.sid,
        from_number: c.from || null,
        to_number: c.to || null,
        call_direction: 'inbound' as const,
        call_status: callStatus,
        call_duration: callDuration,
        call_started_at: callStartedAt,
        call_ended_at: callEndedAt,
        call_source: 'twilio_api_sync',
        ...(lead ? { lead_id: lead.lead_id, taalk_lead_id: lead.taalk_lead_id } : {}),
      };
      const { error } = await supabaseAdmin.from('twilio_call_logs').upsert(row, { onConflict: 'twilio_call_sid' });
      if (error) errors++;

      if (callStatus === 'completed' && !(existing as any)?.owner_email) {
        try {
          const childCalls = await client.calls.list({ parentCallSid: c.sid, limit: 5 });
          const agentLeg = childCalls.find((leg: any) => {
            const to = String(leg.to || '').trim();
            const from = String(leg.from || '').trim();
            return to.toLowerCase().startsWith('client:') || from.toLowerCase().startsWith('client:');
          });
          if (agentLeg) {
            const raw = String((agentLeg as any).to || (agentLeg as any).from || '').trim();
            const identity = raw.toLowerCase().startsWith('client:') ? raw.slice(7).trim() : raw;
            if (identity && identity.includes('@')) {
              const [associateId, lead] = await Promise.all([
                resolveAssociateId(identity),
                getLeadByPhone(c.from),
              ]);
              const updatePayload: Record<string, unknown> = {
                owner_email: identity,
                ...(agentLeg.duration != null ? { call_duration: parseInt(String(agentLeg.duration), 10) || callDuration } : {}),
                ...(associateId != null ? { associate_id: associateId } : {}),
                ...(lead ? { lead_id: lead.lead_id, taalk_lead_id: lead.taalk_lead_id } : {}),
              };
              const { error: upErr } = await supabaseAdmin
                .from('twilio_call_logs')
                .update(updatePayload)
                .eq('twilio_call_sid', c.sid);
              if (!upErr) {
                if (errors === 0 && calls.length <= 20) console.log(`inbound-calls-twilio-sync: tied ${c.sid} → ${identity}${associateId != null ? ` associate_id=${associateId}` : ''}${lead ? ` lead_id=${lead.lead_id}` : ''}`);
              } else errors++;
            }
          }
        } catch (_) {}
      }
    }
    if (calls.length > 0) {
      console.log(`inbound-calls-twilio-sync: synced ${calls.length} inbound calls to twilio_call_logs (${errors} errors)`);
    }

    // Taalk enrichment pass: find any recently-synced inbound rows missing taalk metadata and enrich them
    await enrichUnenrichedInboundCalls().catch((e) => console.warn('inbound-calls-twilio-sync: taalk enrichment error', (e as Error)?.message));

    // Kill zombie calls: any in-progress inbound call older than 30 minutes
    await killZombieInboundCalls().catch((e) => console.warn('zombie-call-killer error:', (e as Error)?.message));

    // Unstick workers stuck in Wrap for more than 2 minutes
    await unstickWrapWorkers().catch((e) => console.warn('unstick-wrap error:', (e as Error)?.message));

    // Fix stale "queued" rows — call ended in Twilio but DB never updated
    await fixStaleQueuedRows().catch((e) => console.warn('fix-stale-queued error:', (e as Error)?.message));

    return { count: calls.length, errors };
  } catch (e) {
    console.warn('inbound-calls-twilio-sync error:', (e as Error)?.message);
    return { count: 0, errors: 1 };
  }
}

/**
 * Kill zombie inbound calls: any call TO our inbound numbers that's been in-progress > 30 minutes.
 * These are stuck dequeue legs where neither side properly hung up.
 */
const MAX_CALL_DURATION_MS = 30 * 60 * 1000; // 30 minutes
/**
 * Unstick workers in Wrap activity for more than 2 minutes → set to AvailableInbound.
 * The old 30s wrap + broken dequeue-status left workers stuck indefinitely.
 */
const WRAP_MAX_MS = 2 * 60 * 1000;       // 2 min for Wrap
const BUSY_MAX_MS = 30 * 60 * 1000;      // 30 min for BusyOnCall
const AVAILABLE_INBOUND_SID = 'WAc2513cd4c7ec03511690c328ff2a49cd';
const WRAP_ACTIVITY_SID = 'WA7cbb8457461d3e22fd83473d7186a3d5';
const BUSY_ACTIVITY_SID = 'WA5306bcbb57fd389e964b4190ceaf71cc';
async function unstickWrapWorkers(): Promise<void> {
  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
  const wsBase = `https://taskrouter.twilio.com/v1/Workspaces/WS6a978202496f59f6cd478c1310f5c2eb`;
  let unstuck = 0;

  // Unstick Wrap workers > 2 min
  for (const actSid of [WRAP_ACTIVITY_SID, BUSY_ACTIVITY_SID]) {
    const maxMs = actSid === WRAP_ACTIVITY_SID ? WRAP_MAX_MS : BUSY_MAX_MS;
    const label = actSid === WRAP_ACTIVITY_SID ? 'Wrap' : 'BusyOnCall';
    try {
      const resp = await fetch(`${wsBase}/Workers?ActivitySid=${actSid}&PageSize=50`, {
        headers: { 'Authorization': `Basic ${auth}` },
        signal: AbortSignal.timeout(10000),
      });
      if (!resp.ok) continue;
      const data = await resp.json() as any;
      for (const w of (data.workers || [])) {
        const statusChanged = w.date_status_changed ? new Date(w.date_status_changed).getTime() : 0;
        if (statusChanged && (Date.now() - statusChanged) > maxMs) {
          const upResp = await fetch(`${wsBase}/Workers/${w.sid}`, {
            method: 'POST',
            headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `ActivitySid=${AVAILABLE_INBOUND_SID}`,
            signal: AbortSignal.timeout(10000),
          });
          if (upResp.ok) {
            console.log(`unstick-workers: ✅ ${w.friendly_name} (${label} ${Math.round((Date.now() - statusChanged) / 60000)}min) → AvailableInbound`);
            unstuck++;
          }
        }
      }
    } catch (_) {}
  }
  if (unstuck > 0) console.log(`unstick-workers: freed ${unstuck} workers`);
}

/**
 * Fix stale "queued" rows in twilio_call_logs — calls ended in Twilio but DB never got updated.
 * Checks rows from last 30 min that are still "queued" and syncs real status from Twilio API.
 */
async function fixStaleQueuedRows(): Promise<void> {
  if (!supabaseAdmin) return;
  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
  const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data: rows } = await supabaseAdmin
    .from('twilio_call_logs')
    .select('twilio_call_sid')
    .eq('call_status', 'queued')
    .eq('call_direction', 'inbound')
    .gte('call_started_at', since)
    .limit(50);
  if (!rows?.length) return;
  let fixed = 0;
  for (const r of rows) {
    try {
      const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls/${r.twilio_call_sid}.json`, {
        headers: { 'Authorization': `Basic ${auth}` },
        signal: AbortSignal.timeout(5000),
      });
      if (!resp.ok) continue;
      const call = await resp.json() as any;
      if (call.status && call.status !== 'queued') {
        await supabaseAdmin.from('twilio_call_logs').update({
          call_status: call.status,
          call_duration: call.duration != null ? parseInt(String(call.duration)) : 0,
          ...(call.end_time ? { call_ended_at: new Date(call.end_time).toISOString() } : {}),
          updated_at: new Date().toISOString(),
        }).eq('twilio_call_sid', r.twilio_call_sid);
        fixed++;
      }
    } catch (_) {}
  }
  if (fixed > 0) console.log(`fix-stale-queued: updated ${fixed} rows from queued → real status`);
}

async function killZombieInboundCalls(): Promise<void> {
  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
  let killed = 0;

  for (const inboundNumber of INBOUND_NUMBERS) {
    try {
      const resp = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json?Status=in-progress&To=${encodeURIComponent(inboundNumber)}&PageSize=20`,
        { headers: { 'Authorization': `Basic ${auth}` }, signal: AbortSignal.timeout(10000) }
      );
      if (!resp.ok) continue;
      const data = await resp.json() as any;
      for (const call of (data.calls || [])) {
        const startTime = new Date(call.start_time).getTime();
        const age = Date.now() - startTime;
        if (age > MAX_CALL_DURATION_MS) {
          // Kill it
          const killResp = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls/${call.sid}.json`,
            {
              method: 'POST',
              headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
              body: 'Status=completed',
              signal: AbortSignal.timeout(10000),
            }
          );
          if (killResp.ok) {
            console.log(`zombie-call-killer: ✅ killed ${call.sid} (${Math.round(age / 60000)}min old, from ${call.from})`);
            killed++;
          }
        }
      }
    } catch (_) {}
  }

  // Also kill zombie client: calls (agent legs) older than 30 min
  try {
    const resp = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json?Status=in-progress&PageSize=50`,
      { headers: { 'Authorization': `Basic ${auth}` }, signal: AbortSignal.timeout(10000) }
    );
    if (resp.ok) {
      const data = await resp.json() as any;
      for (const call of (data.calls || [])) {
        const to = String(call.to || '').toLowerCase();
        const from = String(call.from || '').toLowerCase();
        const isClientCall = to.startsWith('client:') || from.startsWith('client:');
        if (!isClientCall) continue;
        const startTime = new Date(call.start_time).getTime();
        const age = Date.now() - startTime;
        if (age > MAX_CALL_DURATION_MS) {
          const killResp = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls/${call.sid}.json`,
            {
              method: 'POST',
              headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
              body: 'Status=completed',
              signal: AbortSignal.timeout(10000),
            }
          );
          if (killResp.ok) {
            console.log(`zombie-call-killer: ✅ killed client leg ${call.sid} (${Math.round(age / 60000)}min old, ${to || from})`);
            killed++;
          }
        }
      }
    }
  } catch (_) {}

  if (killed > 0) console.log(`zombie-call-killer: killed ${killed} zombie calls`);
}

/**
 * Find inbound twilio_call_logs rows from the last 30 minutes that are missing Taalk enrichment
 * (no taalk_call_id in metadata). For each, query Taalk contacts API by phone, get the call details,
 * and write persona, campaign, recording_url, etc. back to the row.
 */
async function enrichUnenrichedInboundCalls(): Promise<void> {
  if (!supabaseAdmin) return;
  const TAALK_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4";
  const TAALK_HEADERS = {
    'Authorization': `Bearer ${TAALK_KEY}`,
    'Origin': 'https://lets.taalk.ai',
    'Referer': 'https://lets.taalk.ai/',
    'Accept': 'application/json',
  };

  const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data: rows } = await supabaseAdmin
    .from('twilio_call_logs')
    .select('twilio_call_sid, from_number, metadata')
    .in('call_source', ['incomingcall_609', 'taskrouter_inbound'])
    .gte('call_started_at', since)
    .limit(50);

  if (!rows || rows.length === 0) return;

  let enriched = 0;
  for (const row of rows) {
    // Skip if already enriched
    const meta = row.metadata && typeof row.metadata === 'object' ? (row.metadata as Record<string, unknown>) : {};
    if (meta.taalk_call_id) continue;

    const phone10 = normalize10(row.from_number);
    if (phone10.length < 10) continue;

    try {
      // Query Taalk contacts by phone
      const contactResp = await fetch(`https://api.taalk.ai/api/contacts?db=michaelmandella&phone=${phone10}`, {
        headers: TAALK_HEADERS,
        signal: AbortSignal.timeout(10000),
      });
      if (!contactResp.ok) continue;
      const contactData = await contactResp.json() as any;
      const contact = contactData.payload?.[0] || (Array.isArray(contactData) ? contactData[0] : null);
      if (!contact) continue;

      const taalkCallId = contact.session || contact.sessionId || contact.Taalk_SessionId || contact._id;
      if (!taalkCallId) continue;

      // Fetch call details for persona, campaign, etc.
      let callDetails: any = null;
      try {
        const callResp = await fetch(`https://api.taalk.ai/api/calls/${taalkCallId}?db=michaelmandella`, {
          headers: TAALK_HEADERS,
          signal: AbortSignal.timeout(10000),
        });
        if (callResp.ok) callDetails = await callResp.json();
      } catch (_) {}

      // Resolve agent (persona) and campaign names from their IDs
      const callPayload = callDetails?.payload || callDetails;
      const taalkAgentId = callPayload?.agent || null;
      const taalkCampaignId = callPayload?.campaign || null;
      let personaName: string | null = null;
      let campaignName: string | null = null;
      if (taalkAgentId) {
        try {
          const agentResp = await fetch(`https://api.taalk.ai/api/agents/${taalkAgentId}?db=michaelmandella`, {
            headers: TAALK_HEADERS, signal: AbortSignal.timeout(5000),
          });
          if (agentResp.ok) {
            const agentData = (await agentResp.json() as any)?.payload || await agentResp.json();
            personaName = agentData?.name || null;
          }
        } catch (_) {}
      }
      if (taalkCampaignId) {
        try {
          const campResp = await fetch(`https://api.taalk.ai/api/campaign2s/${taalkCampaignId}?db=michaelmandella`, {
            headers: TAALK_HEADERS, signal: AbortSignal.timeout(5000),
          });
          if (campResp.ok) {
            const campData = (await campResp.json() as any)?.payload || await campResp.json();
            campaignName = campData?.name || null;
          }
        } catch (_) {}
      }
      const source = callPayload?.params?.Taalk_Lead_Source || null;
      const groupCode = callPayload?.params?.Taalk_GroupCode || null;
      const taalkRecUrl = `https://api.taalk.ai/api/calls/${taalkCallId}/recording?db=michaelmandella`;

      // DO NOT download recording here — call may still be live.
      // Taalk continues recording through transfer + agent conversation.
      // Recordings are downloaded in a separate pass (downloadCompletedCallRecordings) after calls end.
      const { error: upErr } = await supabaseAdmin.from('twilio_call_logs').update({
        metadata: {
          ...meta,
          taalk_call_id: taalkCallId,
          taalk_contact_id: contact._id,
          taalk_agent_id: taalkAgentId,
          taalk_persona_name: personaName,
          taalk_campaign_id: taalkCampaignId,
          taalk_campaign_name: campaignName,
          taalk_source: source,
          taalk_group_code: groupCode,
          taalk_recording_url: taalkRecUrl,
          taalk_enriched_at: new Date().toISOString(),
        },
      }).eq('twilio_call_sid', row.twilio_call_sid);

      if (!upErr) {
        enriched++;
        console.log(`inbound-taalk-enrich: ✅ ${row.twilio_call_sid} → taalk_call_id=${taalkCallId} persona=${personaName} campaign=${campaignName} recording=${supabaseRecordingUrl ? 'uploaded' : 'skipped'}`);
      }
    } catch (_) {}
  }
  if (enriched > 0) console.log(`inbound-taalk-enrich: enriched ${enriched} rows`);
}

/**
 * Download taalk recordings for COMPLETED inbound calls that have taalk_call_id but no recording_url.
 * Taalk continues recording through transfer + agent conversation, so we must wait until the call ends.
 * Looks at calls from the last 2 hours that are completed (not in-progress).
 */
async function downloadCompletedCallRecordings(): Promise<void> {
  if (!supabaseAdmin) return;
  const TAALK_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4";
  const TAALK_HEADERS = {
    'Authorization': `Bearer ${TAALK_KEY}`,
    'Origin': 'https://lets.taalk.ai',
    'Referer': 'https://lets.taalk.ai/',
    'Accept': 'application/json',
  };

  const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  // Find inbound calls that have taalk_call_id but need a recording download:
  // 1. No recording_url at all, OR
  // 2. recording_url is a Twilio URL (0-byte empty files from WebRTC dequeue — can't record client: calls)
  //    AND no taalk_supabase_recording_url yet
  const { data: rows } = await supabaseAdmin
    .from('twilio_call_logs')
    .select('twilio_call_sid, metadata, recording_url, call_status')
    .eq('call_direction', 'inbound')
    .gte('call_started_at', since)
    .limit(50);

  if (!rows || rows.length === 0) return;

  // Filter: needs download if no recording, or has a Twilio URL (empty) but no taalk supabase URL
  const needsDownload = rows.filter(row => {
    const meta = row.metadata && typeof row.metadata === 'object' ? (row.metadata as Record<string, unknown>) : {};
    if (!meta.taalk_call_id) return false;
    if (meta.taalk_supabase_recording_url) return false; // already downloaded
    if (!row.recording_url) return true; // no recording at all
    if (String(row.recording_url).includes('api.twilio.com')) return true; // Twilio URL = empty for WebRTC
    return false;
  });

  if (!rows || rows.length === 0) return;

  if (needsDownload.length === 0) return;

  let downloaded = 0;
  for (const row of needsDownload) {
    const meta = row.metadata && typeof row.metadata === 'object' ? (row.metadata as Record<string, unknown>) : {};
    const taalkCallId = meta.taalk_call_id as string;

    // Skip if call is still in-progress (not completed yet)
    const status = (row.call_status || '').toLowerCase();
    if (status === 'in-progress' || status === 'ringing' || status === 'queued') continue;

    const taalkRecUrl = `https://api.taalk.ai/api/calls/${taalkCallId}/recording?db=michaelmandella`;
    try {
      const recResp = await fetch(taalkRecUrl, {
        headers: TAALK_HEADERS,
        signal: AbortSignal.timeout(30000),
      });
      if (!recResp.ok) continue;
      const recBuffer = Buffer.from(await recResp.arrayBuffer());
      // Only save if recording is substantial (>50KB = ~3+ seconds of real audio)
      // Small recordings (<10KB) are just the AI greeting before transfer
      if (recBuffer.length < 50000) {
        console.log(`recording-download: ${row.twilio_call_sid} taalk recording too small (${recBuffer.length} bytes) — call may not have bridged, skipping`);
        continue;
      }
      const { SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_ANON_KEY } = await import('./hardcoded-config.js');
      const storagePath = `recordings/taalk-${taalkCallId}-${Date.now()}.mp3`;
      const uploadResp = await fetch(`${SUPABASE_URL}/storage/v1/object/csv-reports/${storagePath}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': 'audio/mpeg',
          'x-upsert': 'true',
        },
        body: recBuffer,
      });
      if (uploadResp.ok) {
        const supabaseRecordingUrl = `${SUPABASE_URL}/storage/v1/object/public/csv-reports/${storagePath}`;
        await supabaseAdmin.from('twilio_call_logs').update({
          recording_url: supabaseRecordingUrl,
          metadata: { ...meta, taalk_supabase_recording_url: supabaseRecordingUrl },
        }).eq('twilio_call_sid', row.twilio_call_sid);
        downloaded++;
        console.log(`recording-download: ✅ ${row.twilio_call_sid} → ${(recBuffer.length / 1024).toFixed(0)}KB → ${supabaseRecordingUrl}`);
      }
    } catch (err) {
      console.warn(`recording-download: failed for ${row.twilio_call_sid}:`, (err as Error)?.message);
    }
  }
  if (downloaded > 0) console.log(`recording-download: downloaded ${downloaded} completed call recordings`);
}

export function startInboundCallsTwilioSync(): void {
  if (intervalId) return;
  syncInboundCallsFromTwilio().then(() => {
    intervalId = setInterval(syncInboundCallsFromTwilio, INTERVAL_MS);
  });
  // Also run recording downloads on the same interval
  downloadCompletedCallRecordings().then(() => {
    setInterval(downloadCompletedCallRecordings, INTERVAL_MS);
  });
  console.log(`✅ Inbound calls Twilio sync started — fetching calls to ${INBOUND_NUMBERS.join(', ')} every 5 minutes (with Taalk enrichment + delayed recording download)`);
}

export function stopInboundCallsTwilioSync(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
