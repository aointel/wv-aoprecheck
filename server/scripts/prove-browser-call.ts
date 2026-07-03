/**
 * Prove we can get a real inbound call on the browser.
 * 1) Puts the agent's TaskRouter worker Online (AvailableInbound + contact_uri).
 * 2) Creates a real 609-style task so TaskRouter offers it → assignment callback returns dequeue → Twilio calls client:email → browser should ring.
 *
 * Prereq: Same env as production (TWILIO_*, SUPABASE_*, etc.). Run from repo root.
 *
 * Run: npx tsx server/scripts/prove-browser-call.ts [email]
 * Default email: cnsysop@aoglobelife.com
 *
 * BEFORE running:
 * - Open https://aoirail-production-baa2.up.railway.app/connect (or your app URL)
 * - Log in as the same email
 * - Click "Online" (VDP or WebRTC) so the Device is registered
 *
 * THEN run this script. In 5–15 seconds the browser should ring (incoming call). Click Accept to connect.
 * If it doesn't ring: check assignment callback URL, worker contact_uri, and that the token identity matches the worker.
 */
import { supabaseAdmin } from '../supabase.js';
import {
  isTaskRouterConfigured,
  setWorkerAvailableForVoice,
  buildTaskAttributesFor609Inbound,
  createTask,
} from '../taskrouter-service.js';

const DEFAULT_EMAIL = 'cnsysop@aoglobelife.com';

async function main() {
  const email = (process.argv[2] || process.env.AGENT_EMAIL || DEFAULT_EMAIL).trim().toLowerCase();
  if (!email || !email.includes('@')) {
    console.error('Usage: npx tsx server/scripts/prove-browser-call.ts [email]');
    process.exit(1);
  }

  if (!isTaskRouterConfigured()) {
    console.error('TaskRouter not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_TASKROUTER_WORKSPACE_SID, TWILIO_TASKROUTER_WORKFLOW_INBOUND_SID.');
    process.exit(1);
  }

  console.log('=== Prove browser call ===');
  console.log('Agent:', email);
  console.log('');

  // 1) Put worker Online (same as clicking Online in the app)
  let customer: { market?: unknown; states?: unknown; associate_id?: unknown; first_name?: string | null; last_name?: string | null } | null = null;
  if (supabaseAdmin) {
    const cols = 'market, states, associate_id, first_name, last_name';
    const { data: byCompany } = await supabaseAdmin
      .from('customers')
      .select(cols)
      .ilike('company_email', email)
      .limit(1)
      .maybeSingle();
    if (byCompany) customer = byCompany;
    else {
      const { data: byPersonal } = await supabaseAdmin
        .from('customers')
        .select(cols)
        .ilike('personal_email', email)
        .limit(1)
        .maybeSingle();
      if (byPersonal) customer = byPersonal;
    }
  }

  console.log('Step 1: Setting worker Online (AvailableInbound + contact_uri)...');
  const { workerSid } = await setWorkerAvailableForVoice(email, customer);
  console.log('  Worker SID:', workerSid);
  console.log('  contact_uri will be client:' + email);
  console.log('');

  // 2) Create a real task (same path as a 609 call enqueue)
  const callSid = 'CA-prove-browser-' + Date.now();
  const market = 'Globe Market';
  const state = 'FL';
  const attributes = buildTaskAttributesFor609Inbound({
    call_sid: callSid,
    phone_number: '+1555PROVE00',
    market,
    state,
    lead_name: 'Prove browser call',
    first_name: 'Prove',
    last_name: 'Browser',
  });

  console.log('Step 2: Creating 609-style task (market=' + market + ', state=' + state + ')...');
  const { taskSid } = await createTask(attributes);
  console.log('  Task SID:', taskSid);
  console.log('');

  console.log('--- Result ---');
  console.log('TaskRouter will: offer task → assignment callback → return dequeue → Twilio calls client:' + email);
  console.log('');
  console.log('Your browser (Connect page, logged in as ' + email + ', Voice On) should ring in 5–15 seconds.');
  console.log('If it does not ring:');
  console.log('  1. Confirm you are on /connect with WebRTC/VDP Online.');
  console.log('  2. Check assignment callback URL points to this app and returns dequeue.');
  console.log('  3. Run: npx tsx server/scripts/check-worker-cnsysop.ts (or list-taskrouter-workers) and verify contact_uri.');
  console.log('  4. Ensure Twilio Voice token identity is exactly: ' + email);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
