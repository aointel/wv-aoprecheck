/**
 * Backfill all 2026-03-16 inbound calls in twilio_call_logs:
 * 1) Twilio API: find the dequeue bridge leg (FROM our inbound number TO caller phone)
 *    → its parent is client:agent@email → owner_email
 * 2) Taalk API: phone → contact → call → agent/campaign names, recording → Supabase
 *
 * Run: npx tsx server/scripts/backfill-inbound-2026-03-16.ts
 */

import { supabaseAdmin } from '../supabase.js';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_ANON_KEY } from '../hardcoded-config.js';

const TAALK_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4";
const TAALK_HEADERS = {
  'Authorization': `Bearer ${TAALK_KEY}`,
  'Origin': 'https://lets.taalk.ai',
  'Referer': 'https://lets.taalk.ai/',
  'Accept': 'application/json',
};
const TWILIO_AUTH = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
const INBOUND_NUMBERS = ['+16096048379', '+16095473687'];

function normalize10(phone: string | null | undefined): string {
  return String(phone || '').replace(/\D/g, '').slice(-10);
}

async function resolveAssociateId(email: string): Promise<number | null> {
  if (!supabaseAdmin || !email?.includes('@')) return null;
  const e = email.trim().toLowerCase();
  const { data: c1 } = await supabaseAdmin.from('customers').select('associate_id').eq('company_email', e).maybeSingle();
  if (c1?.associate_id != null) return Number(c1.associate_id);
  const { data: c2 } = await supabaseAdmin.from('customers').select('associate_id').eq('personal_email', e).maybeSingle();
  if (c2?.associate_id != null) return Number(c2.associate_id);
  return null;
}

/** Cache: agent ID → name, campaign ID → name (avoid re-fetching) */
const agentNameCache = new Map<string, string | null>();
const campaignNameCache = new Map<string, string | null>();

async function getAgentName(agentId: string): Promise<string | null> {
  if (agentNameCache.has(agentId)) return agentNameCache.get(agentId)!;
  try {
    const resp = await fetch(`https://api.taalk.ai/api/agents/${agentId}?db=michaelmandella`, {
      headers: TAALK_HEADERS, signal: AbortSignal.timeout(5000),
    });
    if (resp.ok) {
      const data = (await resp.json() as any)?.payload || {};
      const name = data.name || null;
      agentNameCache.set(agentId, name);
      return name;
    }
  } catch (_) {}
  agentNameCache.set(agentId, null);
  return null;
}

async function getCampaignName(campaignId: string): Promise<string | null> {
  if (campaignNameCache.has(campaignId)) return campaignNameCache.get(campaignId)!;
  try {
    const resp = await fetch(`https://api.taalk.ai/api/campaign2s/${campaignId}?db=michaelmandella`, {
      headers: TAALK_HEADERS, signal: AbortSignal.timeout(5000),
    });
    if (resp.ok) {
      const data = (await resp.json() as any)?.payload || {};
      const name = data.name || null;
      campaignNameCache.set(campaignId, name);
      return name;
    }
  } catch (_) {}
  campaignNameCache.set(campaignId, null);
  return null;
}

/**
 * For a given inbound call, find the agent who answered by looking for the dequeue bridge leg.
 * TaskRouter dequeue creates: client:agent@ → (parent: none), then FROM inbound# TO callerPhone (parent: client leg).
 * We search Twilio for calls FROM our inbound numbers TO the caller phone in a time window.
 */
async function findAgentForInboundCall(callerPhone: string, callStartTime: string): Promise<string | null> {
  const callerE164 = callerPhone.startsWith('+') ? callerPhone : `+1${normalize10(callerPhone)}`;
  const startTime = new Date(callStartTime);
  const windowStart = new Date(startTime.getTime() - 30000).toISOString().slice(0, 19) + 'Z';
  const windowEnd = new Date(startTime.getTime() + 120000).toISOString().slice(0, 19) + 'Z';

  for (const inboundNum of INBOUND_NUMBERS) {
    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json?From=${encodeURIComponent(inboundNum)}&To=${encodeURIComponent(callerE164)}&StartTimeAfter=${windowStart}&StartTimeBefore=${windowEnd}&PageSize=5`;
      const resp = await fetch(url, {
        headers: { 'Authorization': `Basic ${TWILIO_AUTH}` },
        signal: AbortSignal.timeout(10000),
      });
      if (!resp.ok) continue;
      const data = await resp.json() as any;
      const bridgeLegs = (data.calls || []).filter((c: any) => c.parent_call_sid);
      for (const leg of bridgeLegs) {
        // The parent of this leg is the client:agent@ call
        const parentSid = leg.parent_call_sid;
        const parentResp = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls/${parentSid}.json`,
          { headers: { 'Authorization': `Basic ${TWILIO_AUTH}` }, signal: AbortSignal.timeout(10000) }
        );
        if (!parentResp.ok) continue;
        const parent = await parentResp.json() as any;
        const clientTo = String(parent.to || '').trim();
        if (clientTo.toLowerCase().startsWith('client:')) {
          const email = clientTo.slice(7).trim();
          if (email.includes('@')) return email;
        }
        const clientFrom = String(parent.from || '').trim();
        if (clientFrom.toLowerCase().startsWith('client:')) {
          const email = clientFrom.slice(7).trim();
          if (email.includes('@')) return email;
        }
      }
    } catch (_) {}
  }
  return null;
}

async function main() {
  if (!supabaseAdmin) { console.error('No supabaseAdmin'); process.exit(1); }

  const { data: rows, error } = await supabaseAdmin
    .from('twilio_call_logs')
    .select('twilio_call_sid, from_number, to_number, owner_email, call_status, call_duration, recording_url, metadata, lead_id, taalk_lead_id, call_started_at')
    .in('call_source', ['incomingcall_609', 'taskrouter_inbound'])
    .gte('call_started_at', '2026-03-16T00:00:00Z')
    .order('call_started_at', { ascending: true });

  if (error || !rows) { console.error('Failed to fetch rows:', error?.message); process.exit(1); }
  console.log(`Found ${rows.length} inbound rows for 2026-03-16\n`);

  let updatedAgent = 0, updatedTaalk = 0, updatedRecording = 0, errors = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const sid = row.twilio_call_sid;
    const phone10 = normalize10(row.from_number);
    const meta = (typeof row.metadata === 'object' && row.metadata) ? (row.metadata as Record<string, unknown>) : {};
    const updates: Record<string, unknown> = {};
    const metaUpdates: Record<string, unknown> = { ...meta };
    let changed = false;

    // ──────────────────── STEP 1: Find agent via Twilio bridge leg ────────────────────
    if ((!row.owner_email || row.owner_email === '') && (row.call_duration || 0) > 10 && row.call_started_at) {
      try {
        const agentEmail = await findAgentForInboundCall(row.from_number || '', row.call_started_at);
        if (agentEmail) {
          updates.owner_email = agentEmail;
          updates.agent_identity = `client:${agentEmail}`;
          updates.call_source = 'taskrouter_inbound';
          metaUpdates.agent_email = agentEmail;
          metaUpdates.bridged_at = metaUpdates.bridged_at || row.call_started_at;
          const associateId = await resolveAssociateId(agentEmail);
          if (associateId != null) updates.associate_id = associateId;
          changed = true;
          updatedAgent++;
        }
      } catch (e) {
        console.warn(`  [${i}] Agent lookup failed for ${sid}:`, (e as Error)?.message);
      }
    }

    // ──────────────────── STEP 2: Taalk enrichment ────────────────────
    if (!meta.taalk_call_id && phone10.length >= 10) {
      try {
        const contactResp = await fetch(`https://api.taalk.ai/api/contacts?db=michaelmandella&phone=${phone10}`, {
          headers: TAALK_HEADERS, signal: AbortSignal.timeout(10000),
        });
        if (contactResp.ok) {
          const contactData = await contactResp.json() as any;
          const contact = contactData.payload?.[0] || (Array.isArray(contactData) ? contactData[0] : null);
          if (contact) {
            const taalkCallId = contact.session || contact.sessionId || contact.Taalk_SessionId || contact._id;
            if (taalkCallId) {
              metaUpdates.taalk_call_id = taalkCallId;
              metaUpdates.taalk_contact_id = contact._id;

              let callPayload: any = null;
              try {
                const callResp = await fetch(`https://api.taalk.ai/api/calls/${taalkCallId}?db=michaelmandella`, {
                  headers: TAALK_HEADERS, signal: AbortSignal.timeout(10000),
                });
                if (callResp.ok) callPayload = (await callResp.json() as any)?.payload || null;
              } catch (_) {}

              const agentId = callPayload?.agent || null;
              const campaignId = callPayload?.campaign || null;

              if (agentId) {
                metaUpdates.taalk_agent_id = agentId;
                metaUpdates.taalk_persona_name = await getAgentName(agentId);
              }
              if (campaignId) {
                metaUpdates.taalk_campaign_id = campaignId;
                metaUpdates.taalk_campaign_name = await getCampaignName(campaignId);
              }

              metaUpdates.taalk_source = callPayload?.params?.Taalk_Lead_Source || null;
              metaUpdates.taalk_group_code = callPayload?.params?.Taalk_GroupCode || null;
              metaUpdates.taalk_recording_url = `https://api.taalk.ai/api/calls/${taalkCallId}/recording?db=michaelmandella`;
              metaUpdates.recording_source = 'taalk';
              metaUpdates.taalk_enriched_at = new Date().toISOString();
              changed = true;
              updatedTaalk++;

              // ──────────────────── STEP 3: Recording ────────────────────
              if (!row.recording_url) {
                try {
                  const recResp = await fetch(`https://api.taalk.ai/api/calls/${taalkCallId}/recording?db=michaelmandella`, {
                    headers: { ...TAALK_HEADERS, 'Accept': 'audio/mpeg, audio/mp3, audio/*, */*' },
                    signal: AbortSignal.timeout(30000),
                  });
                  if (recResp.ok) {
                    const recBuffer = Buffer.from(await recResp.arrayBuffer());
                    if (recBuffer.length > 1000) {
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
                        updates.recording_url = `${SUPABASE_URL}/storage/v1/object/public/csv-reports/${storagePath}`;
                        updatedRecording++;
                      }
                    }
                  }
                } catch (_) {}
              }
            }
          }
        }
      } catch (e) {
        console.warn(`  [${i}] Taalk failed for ${sid}:`, (e as Error)?.message);
      }
    }

    // ──────────────────── WRITE ────────────────────
    if (changed) {
      updates.metadata = metaUpdates;
      updates.updated_at = new Date().toISOString();
      const { error: upErr } = await supabaseAdmin.from('twilio_call_logs').update(updates).eq('twilio_call_sid', sid);
      if (upErr) {
        console.warn(`  [${i}] Update failed ${sid}:`, upErr.message);
        errors++;
      } else {
        const agent = (updates.owner_email as string) || '—';
        const persona = metaUpdates.taalk_persona_name || '—';
        const campaign = metaUpdates.taalk_campaign_name || '—';
        const rec = updates.recording_url ? '✅rec' : '—';
        console.log(`  [${i}] ✅ ${sid.slice(0,20)} | agent:${agent.slice(0,25)} | ${persona} | ${campaign} | ${rec}`);
      }
    } else if (i % 20 === 0) {
      console.log(`  [${i}] skip (already enriched or no match)`);
    }

    // Pace: avoid rate limits
    if (i % 5 === 4) await new Promise(r => setTimeout(r, 300));
  }

  console.log(`\n✅ Done. ${rows.length} rows processed.`);
  console.log(`  Agents resolved: ${updatedAgent}`);
  console.log(`  Taalk enriched: ${updatedTaalk}`);
  console.log(`  Recordings uploaded: ${updatedRecording}`);
  console.log(`  Errors: ${errors}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
