/**
 * Put an agent in Online state for TaskRouter (AvailableInbound) so they can take 609 inbound calls.
 * Creates/updates the Worker and sets activity to AvailableInbound (same as clicking Online in the app).
 *
 * Run: npx tsx server/scripts/set-agent-online-taskrouter.ts [email]
 * Default email: chrislafond@aoglobelife.com
 */
import { supabaseAdmin } from '../supabase';
import {
  isTaskRouterConfigured,
  setWorkerAvailableForVoice,
} from '../taskrouter-service';

const DEFAULT_EMAIL = 'chrislafond@aoglobelife.com';

async function main() {
  const email = (process.argv[2] || DEFAULT_EMAIL).trim().toLowerCase();
  if (!email || !email.includes('@')) {
    console.error('Usage: npx tsx server/scripts/set-agent-online-taskrouter.ts [email]');
    process.exit(1);
  }

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
      .ilike('company_email', email)
      .limit(1)
      .maybeSingle();
    if (byCompany) {
      customer = byCompany;
      console.log('Loaded customer (company_email):', { market: customer.market, states: customer.states });
    } else {
      const { data: byPersonal } = await supabaseAdmin
        .from('customers')
        .select(cols)
        .ilike('personal_email', email)
        .limit(1)
        .maybeSingle();
      if (byPersonal) {
        customer = byPersonal;
        console.log('Loaded customer (personal_email):', { market: customer.market, states: customer.states });
      }
    }
  }

  const { workerSid } = await setWorkerAvailableForVoice(email, customer);
  console.log('OK:', email, 'is now Online (AvailableInbound) for TaskRouter. Worker SID:', workerSid);
  console.log('They can receive 609 inbound calls.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
