/**
 * Diagnose why inbound TaskRouter tasks don't show up in the app.
 * Run: npx tsx server/scripts/diagnose-inbound-routing.ts
 *
 * Checks: workflow callback URL, online workers, creates a test task, tells you what to verify.
 */

import {
  isTaskRouterConfigured,
  getWorkflowSidForEnqueue,
  getWorkflowAssignmentCallbackUrl,
  listWorkers,
  buildTaskAttributesForEnqueue,
  createTask,
} from '../taskrouter-service.js';

async function main() {
  console.log('=== Inbound routing diagnostic ===\n');

  if (!isTaskRouterConfigured()) {
    console.log('❌ TaskRouter not configured. Set workspace + workflow SIDs and Twilio credentials.');
    process.exit(1);
  }

  // 1) Workflow assignment callback URL - Twilio POSTs here when offering a task
  const callbackUrl = await getWorkflowAssignmentCallbackUrl();
  console.log('1) Workflow Assignment Callback URL (Twilio must be able to POST here):');
  console.log('   ', callbackUrl ?? '(not set)');
  if (!callbackUrl) {
    console.log('   ❌ No URL set. Run: BASE_URL=https://YOUR-PUBLIC-APP-URL npx tsx server/scripts/provision-taskrouter.ts');
    process.exit(1);
  }
  if (callbackUrl.includes('localhost')) {
    console.log('   ❌ URL is localhost - Twilio cannot reach it. Re-provision with your public URL (e.g. Railway).');
  } else {
    console.log('   ✅ Public URL - Twilio can reach it if the server is running.');
  }
  console.log('   ⚠️  The app you use in the browser MUST be on this SAME origin (same host).');
  console.log('   If you use a different URL (e.g. *-baa2.up.railway.app), re-provision with that as BASE_URL.');
  console.log('');

  // 2) Online workers
  const online = await listWorkers({ availableOnly: true, limit: 20 });
  console.log('2) Online workers (AvailableInbound):', online.length);
  if (online.length === 0) {
    console.log('   ❌ No one online. Go to the app, click Online (VDP or WebRTC) so voice-online runs.');
    console.log('   Then run this script again.');
    process.exit(1);
  }
  online.forEach((w) => {
    let attrs: any = {};
    try {
      attrs = typeof w.attributes === 'string' ? JSON.parse(w.attributes) : w.attributes || {};
    } catch (_) {}
    const email = attrs.agent_email || attrs.email || attrs.contact_uri?.replace('client:', '') || w.friendlyName;
    console.log('   ', w.friendlyName, '| identifier:', email, '|', w.workerSid);
  });
  console.log('');

  // 3) Create a test task
  console.log('3) Creating test task...');
  const attributes = buildTaskAttributesForEnqueue({
    call_sid: 'diag-' + Date.now(),
    source: 'direct_inbound',
    market: 'Test',
    state: 'OR',
    phone_number: '+15032018470',
    lead_name: 'Diagnostic Test Call',
  });
  const { taskSid } = await createTask(attributes);
  console.log('   Task created:', taskSid);
  console.log('');

  console.log('4) What should happen next:');
  console.log('   - Twilio selects an online worker and POSTs to the callback URL above.');
  console.log('   - Your SERVER (the one running at that URL) must receive the POST and log:');
  console.log('     "TaskRouter assignment: task=... worker=... reservation=..."');
  console.log('   - If you do NOT see that log on your server within ~5 seconds:');
  console.log('     • The callback URL is wrong or the server is not that URL.');
  console.log('     • Re-run: BASE_URL=<that exact URL> npx tsx server/scripts/provision-taskrouter.ts');
  console.log('   - If you DO see that log but the app still shows no call:');
  console.log('     • You must be using the SAME server in the browser (same origin as callback URL).');
  console.log('     • If you test on localhost you must poll the same server that received the callback.');
  console.log('');
  console.log('5) Quick check: GET', callbackUrl.replace('/assignment', '/pending'), '?agentEmail=YOUR_EMAIL');
  console.log('   Returns pending reservations for that agent. If assignment was received, you will see them here.');
  console.log('');
  console.log('--- If no call shows in the app ---');
  console.log('Your app URL must match the callback URL above. If you use a different domain (e.g. *-baa2):');
  console.log('  BASE_URL=https://YOUR-ACTUAL-APP-URL npx tsx server/scripts/provision-taskrouter.ts');
  console.log('  (Then create a new test task; Twilio will POST to the new URL and the app will see it.)');
  console.log('\n=== Done ===');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
