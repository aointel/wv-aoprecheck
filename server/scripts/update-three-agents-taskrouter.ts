/**
 * Update TaskRouter worker attributes (markets, licensed_states) for three agents only.
 * Run: npx tsx server/scripts/update-three-agents-taskrouter.ts
 */

const AGENTS = [
  'chrislafond@aoglobelife.com',
  'jessicaboll@aoglobelife.com',
  'jakobleblue@aoglobelife.com',
  'johnsalinas@aoglobelife.com',
  'lanebeasley@aoglobelife.com',
];

import { supabaseAdmin } from '../supabase.js';
import {
  isTaskRouterConfigured,
  listWorkers,
  syncWorker,
  buildWorkerAttributesForVoice,
} from '../taskrouter-service.js';

type CustomerRow = {
  market?: unknown;
  markets?: unknown;
  states?: unknown;
  associate_id?: unknown;
  first_name?: string | null;
  last_name?: string | null;
};

async function getCustomerByEmail(email: string): Promise<CustomerRow | null> {
  if (!supabaseAdmin) return null;
  const cols = 'company_email, market, states, associate_id, first_name, last_name';
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

/** Fallback: agent_profiles has authorized_markets, license_states when customers does not. */
async function getAgentProfileByEmail(email: string): Promise<{ market?: unknown; markets?: unknown; states?: unknown; licensed_states?: unknown; associate_id?: unknown; first_name?: string | null; last_name?: string | null } | null> {
  if (!supabaseAdmin) return null;
  const { data: ap } = await supabaseAdmin
    .from('agent_profiles')
    .select('authorized_markets, license_states, agent_associate_id, first_name, last_name')
    .or(`email.eq.${email},agent_email.eq.${email}`)
    .limit(1)
    .maybeSingle();
  if (!ap) return null;
  const markets = ap.authorized_markets != null ? (Array.isArray(ap.authorized_markets) ? ap.authorized_markets : [ap.authorized_markets]) : [];
  const states = ap.license_states != null ? (Array.isArray(ap.license_states) ? ap.license_states : [ap.license_states]) : [];
  if (markets.length === 0 && states.length === 0) return null;
  return {
    market: markets[0],
    markets,
    states,
    licensed_states: states,
    associate_id: ap.agent_associate_id ?? undefined,
    first_name: ap.first_name ?? null,
    last_name: ap.last_name ?? null,
  };
}

async function main() {
  if (!isTaskRouterConfigured()) {
    console.error('TaskRouter not configured.');
    process.exit(1);
  }

  const workers = await listWorkers();
  const want = new Set(AGENTS.map((e) => e.trim().toLowerCase()));
  const toUpdate = workers.filter((w) => want.has((w.friendlyName || '').trim().toLowerCase()));

  console.log('Agents to update:', AGENTS.length);
  console.log('Found in TaskRouter:', toUpdate.length);

  for (const w of toUpdate) {
    const email = (w.friendlyName || '').trim().toLowerCase();
    let customer = await getCustomerByEmail(email);
    const hasMarketOrState = customer && (
      (customer.market != null && String(customer.market).trim()) ||
      (customer.states != null && (Array.isArray(customer.states) ? customer.states.length > 0 : String(customer.states).trim()))
    );
    if (!hasMarketOrState) {
      const profile = await getAgentProfileByEmail(email);
      if (profile) customer = { ...(customer || {}), ...profile } as CustomerRow;
      else console.warn('No customer or agent_profiles market/states for', email);
    }
    const attributes = buildWorkerAttributesForVoice(email, customer ?? null);

    try {
      await syncWorker({ friendlyName: w.friendlyName, attributes, activitySid: w.activitySid });
      console.log('OK:', email, '| markets:', attributes.markets?.join(', ') || '—', '| states:', attributes.licensed_states?.length ? attributes.licensed_states.join(', ') : '—');
    } catch (e) {
      console.error('FAIL:', email, (e as Error).message);
    }
  }

  const missing = AGENTS.filter((e) => !toUpdate.some((w) => (w.friendlyName || '').trim().toLowerCase() === e.trim().toLowerCase()));
  if (missing.length) console.log('Not found in TaskRouter:', missing.join(', '));
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
