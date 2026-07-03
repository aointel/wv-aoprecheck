/**
 * Verify TaskRouter inbound setup for the 609 number.
 * Run: npx tsx server/scripts/verify-taskrouter-inbound-609.ts
 *      BASE_URL=https://aoirail-production-baa2.up.railway.app npx tsx server/scripts/verify-taskrouter-inbound-609.ts  (dev)
 *
 * Checks: TaskRouter configured, workflow assignment callback URL, online workers.
 * See docs/TASKROUTER_INBOUND_609_SETUP.md for full step-by-step verification.
 */

import {
  isTaskRouterConfigured,
  getWorkflowAssignmentCallbackUrl,
  listWorkers,
} from '../taskrouter-service.js';
import { WEBHOOK_BASE_URL } from '../hardcoded-config.js';

const EXPECTED_ASSIGNMENT_PATH = '/api/twilio/taskrouter/assignment';
const EXPECTED_HOST = process.env.BASE_URL ? new URL(process.env.BASE_URL).host : new URL(WEBHOOK_BASE_URL).host;

async function main() {
  console.log('=== TaskRouter Inbound 609 verification ===\n');
  console.log('Expected host:', EXPECTED_HOST, process.env.BASE_URL ? '(from BASE_URL)' : '(from WEBHOOK_BASE_URL)\n');

  if (!isTaskRouterConfigured()) {
    console.log('❌ TaskRouter not configured.');
    console.log('   Set TWILIO_TASKROUTER_WORKSPACE_SID, TWILIO_TASKROUTER_WORKFLOW_INBOUND_SID, and Twilio credentials.');
    console.log('   Then run: npx tsx server/scripts/provision-taskrouter.ts');
    process.exit(1);
  }
  console.log('✅ TaskRouter configured (workspace + workflow SIDs present)\n');

  const callbackUrl = await getWorkflowAssignmentCallbackUrl();
  console.log('1) Workflow Assignment Callback URL');
  console.log('   ', callbackUrl ?? '(not set)');
  if (!callbackUrl) {
    console.log('   ❌ No URL set. Run:');
    console.log('   npx tsx server/scripts/provision-taskrouter.ts');
    process.exit(1);
  }
  const hasExpectedHost = callbackUrl.includes(EXPECTED_HOST);
  const hasAssignmentPath = callbackUrl.includes(EXPECTED_ASSIGNMENT_PATH);
  if (!hasExpectedHost) {
    console.log('   ⚠️  URL host does not match expected', EXPECTED_HOST);
    console.log('   Re-provision: npx tsx server/scripts/provision-taskrouter.ts');
  } else {
    console.log('   ✅ URL host matches expected (' + EXPECTED_HOST + ').');
  }
  if (!hasAssignmentPath) {
    console.log('   ❌ URL should contain', EXPECTED_ASSIGNMENT_PATH);
  } else {
    console.log('   ✅ Assignment path present.');
  }
  console.log('');

  const online = await listWorkers({ availableOnly: true, limit: 20 });
  console.log('2) Online workers (AvailableInbound):', online.length);
  if (online.length === 0) {
    console.log('   ⚠️  No one online. Have agents go Online so voice-online runs, then re-run.');
  } else {
    console.log('   ✅ At least one worker online.');
    online.slice(0, 5).forEach((w) => {
      let attrs: any = {};
      try {
        attrs = typeof w.attributes === 'string' ? JSON.parse(w.attributes) : w.attributes || {};
      } catch (_) {}
      const email = attrs.agent_email || attrs.email || attrs.contact_uri?.replace('client:', '') || w.friendlyName;
      console.log('   ', w.friendlyName, '|', email);
    });
    if (online.length > 5) console.log('   ... and', online.length - 5, 'more');
  }
  console.log('');

  console.log('3) Next steps');
  console.log('   • 609 Voice URL: ' + (process.env.BASE_URL || WEBHOOK_BASE_URL) + '/incomingcall');
  console.log('   • Check 609: npx tsx server/scripts/check-609-voice-url.ts');
  console.log('   • Test webhook: BASE_URL=' + (process.env.BASE_URL || WEBHOOK_BASE_URL) + ' WEBHOOK_PATH=incomingcall npm run test:webhook-taskrouter');
  console.log('   • Full checklist: docs/TASKROUTER_INBOUND_609_SETUP.md');
  console.log('');
  console.log('=== Done ===');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
