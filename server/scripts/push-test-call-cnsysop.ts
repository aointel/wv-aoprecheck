/**
 * Push a test 609 task so TaskRouter offers it to cnsysop@aoglobelife.com — browser should ring/show inbound card.
 * Prereq: Run sync-cnsysop-inbound609.ts so cnsysop worker exists and is AvailableInbound.
 *
 * Run: npx tsx server/scripts/push-test-call-cnsysop.ts
 */
import {
  isTaskRouterConfigured,
  buildTaskAttributesFor609Inbound,
  createTask,
} from '../taskrouter-service.js';

const TARGET_EMAIL = 'cnsysop@aoglobelife.com';

async function main() {
  if (!isTaskRouterConfigured()) {
    console.error('TaskRouter not configured.');
    process.exit(1);
  }

  const callSid = 'CA-test-cnsysop-' + Date.now();
  const phone = '+15550000000';
  // cnsysop's worker has markets: Globe Market, licensed_states: includes FL — use matching task attributes
  const attributes = buildTaskAttributesFor609Inbound({
    call_sid: callSid,
    phone_number: phone,
    market: 'Globe Market',
    state: 'FL',
    lead_name: 'Test Call (cnsysop)',
    first_name: 'Test',
    last_name: 'Call',
  });

  console.log('Creating test 609 task → Globe Market, FL (should offer to', TARGET_EMAIL + '):');
  console.log('  market: Globe Market, state: FL');
  const { taskSid } = await createTask(attributes);
  console.log('Task created:', taskSid);
  console.log('');
  console.log(TARGET_EMAIL + ' browser (Connect, WebRTC on + Online) should show the inbound call card within a few seconds.');
  console.log('If no ring: run npx tsx server/scripts/diagnose-inbound-routing.ts and npx tsx server/scripts/sync-cnsysop-inbound609.ts');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
