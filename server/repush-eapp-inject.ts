/**
 * repush-eapp-inject.ts
 * One-shot: re-derive inject_payload from stored raw_payload and push to localhost:7432/inject-next.
 * Also updates hppro_eapp_pending with the new payload.
 *
 * Usage: npx ts-node server/repush-eapp-inject.ts [agentEmail] [presentationGuid?]
 *   agentEmail      - defaults to cqlafond@ailife.us
 *   presentationGuid - optional, uses latest unconsumed if omitted
 */

import { supabaseAdmin } from './supabase.js';
import {
  buildEappInjectPayloadFromSyncPresentation,
} from './hppro-eapp-bridge.js';

const agentEmail = (process.argv[2] || 'cqlafond@ailife.us').toLowerCase().trim();
const targetGuid  = process.argv[3] || null;

async function main() {
  if (!supabaseAdmin) throw new Error('supabaseAdmin not configured');

  // 1. Find the presentation row with raw_payload
  let presQuery = supabaseAdmin
    .from('hppro_presentations')
    .select('presentation_guid, raw_payload, what_happened, agent_number')
    .order('synced_at', { ascending: false })
    .limit(1);

  if (targetGuid) {
    presQuery = presQuery.eq('presentation_guid', targetGuid);
  }

  const { data: pres, error: presErr } = await presQuery.maybeSingle();
  if (presErr || !pres) {
    console.error('No presentation found:', presErr?.message);
    process.exit(1);
  }

  console.log(`Found presentation: ${pres.presentation_guid} (${pres.what_happened})`);

  const rawPayload = pres.raw_payload as Record<string, unknown>;
  if (!rawPayload || typeof rawPayload !== 'object') {
    console.error('raw_payload is missing or not an object');
    process.exit(1);
  }

  // 2. Re-derive inject payload with current bridge logic
  const injectPayload = buildEappInjectPayloadFromSyncPresentation(rawPayload);

  console.log('Rebuilt inject payload:');
  const coverageKeys = ['life1GroupId','life1Face','life1Units','accident1GroupId','accident1Face',
    'accident1Units','spouseLife1GroupId','spouseLife1Face','spouseLife1Units',
    'selectedPlanName','totalPremium','isSenior','hasLife','hasAccident','hasSpouseLife','state'];
  for (const k of coverageKeys) {
    if (injectPayload[k]) console.log(`  ${k}: ${injectPayload[k]}`);
  }

  // 3. Update hppro_eapp_pending
  const { error: upsertErr } = await supabaseAdmin
    .from('hppro_eapp_pending')
    .upsert(
      {
        agent_email: agentEmail,
        presentation_guid: pres.presentation_guid,
        inject_payload: injectPayload,
        what_happened: pres.what_happened || null,
        consumed_at: null,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'agent_email,presentation_guid' },
    );

  if (upsertErr) {
    console.error('Supabase upsert error:', upsertErr.message);
  } else {
    console.log('Updated hppro_eapp_pending');
  }

  // 4. POST directly to EappSync on localhost:7432
  try {
    const flat: Record<string, string> = {};
    for (const [k, v] of Object.entries(injectPayload)) flat[k] = v == null ? '' : String(v);

    const res = await fetch('http://localhost:7432/inject-next', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(flat),
    });
    if (res.ok) {
      console.log('✅ Pushed to localhost:7432/inject-next');
    } else {
      console.error('POST failed:', res.status, await res.text().catch(() => ''));
    }
  } catch (e: any) {
    console.error('Could not reach localhost:7432 —', e.message);
    console.log('(EappSync may not be running, but Supabase was updated)');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
