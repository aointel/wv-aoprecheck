/**
 * Create or update the TaskRouter Worker for cnsysop@aoglobelife.com.
 * Loads market and states from Supabase customers table (same as voice-online). Puts worker in AvailableInbound.
 * Routing: market/state only (no routing_target filter).
 *
 * Run: npx tsx server/scripts/sync-cnsysop-inbound609.ts
 */
import { supabaseAdmin } from '../supabase.js';
import {
  isTaskRouterConfigured,
  getActivitySidByName,
  syncWorker,
  setWorkerVoiceCapacity,
  buildWorkerAttributesForVoice,
} from '../taskrouter-service.js';

const EMAIL = 'cnsysop@aoglobelife.com';

async function main() {
  if (!isTaskRouterConfigured()) {
    console.error('TaskRouter not configured. Set TWILIO_TASKROUTER_WORKSPACE_SID and TWILIO_TASKROUTER_WORKFLOW_INBOUND_SID.');
    process.exit(1);
  }
  /** Same process as voice-online: customers has market + states (no "markets"). Use ilike for email. */
  let customer: { market?: unknown; states?: unknown; associate_id?: unknown; first_name?: string | null; last_name?: string | null } | null = null;
  if (supabaseAdmin) {
    const cols = 'market, states, associate_id, first_name, last_name';
    const { data: byCompany } = await supabaseAdmin
      .from('customers')
      .select(cols)
      .ilike('company_email', EMAIL)
      .limit(1)
      .maybeSingle();
    if (byCompany) {
      customer = byCompany;
      console.log('Loaded from customers:', { market: customer.market, states: customer.states });
    } else {
      const { data: byPersonal } = await supabaseAdmin
        .from('customers')
        .select(cols)
        .ilike('personal_email', EMAIL)
        .limit(1)
        .maybeSingle();
      if (byPersonal) {
        customer = byPersonal;
        console.log('Loaded from customers (personal_email):', { market: customer.market, states: customer.states });
      } else {
        console.log('No customers row for', EMAIL, '— using catch-all defaults so cnsysop can receive any 609 test call.');
      }
    }
  }
  // If no customer row, give cnsysop catch-all so they show Available and get any 609 task (for testing).
  const attributes = buildWorkerAttributesForVoice(EMAIL, customer);
  if ((!customer?.market && !customer?.states) || (attributes.markets?.length === 0 && attributes.licensed_states?.length === 0)) {
    attributes.markets = ['Globe Market', 'Veteran', 'Unknown'];
    attributes.licensed_states = ['RI', 'CO', 'WA', 'TX', 'CA', 'FL', 'NY', 'NJ', 'PA', 'OH', 'GA', 'NC', 'VA', 'MA', 'AZ', 'NV', 'CT', 'MD', 'MN', 'WI', 'AL', 'SC', 'LA', 'KY', 'OR', 'OK', 'DC'];
    console.log('Catch-all worker attributes:', { markets: attributes.markets, licensed_states: attributes.licensed_states });
  }
  const availableSid = await getActivitySidByName('AvailableInbound');
  if (!availableSid) {
    console.error('AvailableInbound activity not found. Run: npx tsx server/scripts/provision-taskrouter.ts');
    process.exit(1);
  }
  const { workerSid } = await syncWorker({
    friendlyName: EMAIL,
    attributes,
    activitySid: availableSid,
  });
  try {
    await setWorkerVoiceCapacity(workerSid, 1);
  } catch (e) {
    console.warn('setWorkerVoiceCapacity failed (worker may still work):', e);
  }
  console.log('Worker synced:', workerSid);
  console.log('Attributes:', JSON.stringify(attributes, null, 2));
  console.log('Activity: AvailableInbound');
  console.log('');
  console.log('Next: have cnsysop open the app, go Online (WebRTC). Then call 609.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
