/**
 * Backfill TaskRouter workers with markets and licensed_states from the customers table.
 * Updates each existing worker's attributes (contact_uri, markets, licensed_states, etc.)
 * while preserving their current activity (Offline, AvailableInbound, etc.).
 *
 * Run: npx tsx server/scripts/backfill-taskrouter-worker-markets-states.ts
 */

import { supabaseAdmin } from '../supabase.js';
import {
  isTaskRouterConfigured,
  listWorkersViaFetch,
  updateWorkerAttributesPreservingActivity,
  buildWorkerAttributesForVoice,
} from '../taskrouter-service.js';

type CustomerRow = {
  market?: unknown;
  states?: unknown;
  associate_id?: unknown;
  first_name?: string | null;
  last_name?: string | null;
};

/** Same process as voice-online and update-three-agents: customers has market + states (no "markets" column). Use ilike for email. */
async function getCustomerByEmail(email: string): Promise<CustomerRow | null> {
  if (!supabaseAdmin) return null;
  const cols = 'market, states, associate_id, first_name, last_name';
  const { data: byCompany } = await supabaseAdmin
    .from('customers')
    .select(cols)
    .ilike('company_email', email)
    .limit(1)
    .maybeSingle();
  if (byCompany) return byCompany;
  const { data: byPersonal } = await supabaseAdmin
    .from('customers')
    .select(cols)
    .ilike('personal_email', email)
    .limit(1)
    .maybeSingle();
  return byPersonal ?? null;
}

async function main() {
  if (!isTaskRouterConfigured()) {
    console.error('TaskRouter not configured. Set TWILIO_TASKROUTER_WORKSPACE_SID and TWILIO_TASKROUTER_WORKFLOW_INBOUND_SID.');
    process.exit(1);
  }

  const workers = await listWorkersViaFetch();
  console.log('Workers in TaskRouter:', workers.length);
  if (workers.length === 0) {
    console.log('No workers to backfill.');
    return;
  }

  let updated = 0;
  let failed = 0;

  for (const w of workers) {
    const email = (w.friendlyName || '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      console.warn('Skip worker (no email friendlyName):', w.workerSid);
      continue;
    }

    const customer = await getCustomerByEmail(email);
    const attributes = buildWorkerAttributesForVoice(email, customer ?? null);
    const attributesJson = JSON.stringify(attributes);

    try {
      await updateWorkerAttributesPreservingActivity(w.workerSid, attributesJson, w.activitySid);
      updated++;
      const markets = attributes.markets;
      const states = attributes.licensed_states;
      console.log('OK:', email, '| markets:', markets?.join(', ') || '—', '| states:', states?.length ? states.join(', ') : '—');
    } catch (e) {
      failed++;
      console.error('FAIL:', email, (e as Error).message);
    }
  }

  console.log('\nBackfill done. Updated:', updated, 'Failed:', failed);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
