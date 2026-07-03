/**
 * Create a test 609 task (Veteran, FL) so TaskRouter offers it to Chris — his browser should ring/show inbound card.
 * Prereq: Chris (chrislafond@aoglobelife.com) is AvailableInbound with Veteran + FL.
 *
 * Run: npx tsx server/scripts/test-call-chris.ts
 */
import {
  isTaskRouterConfigured,
  buildTaskAttributesFor609Inbound,
  createTask,
} from '../taskrouter-service.js';

async function main() {
  if (!isTaskRouterConfigured()) {
    console.error('TaskRouter not configured.');
    process.exit(1);
  }

  const callSid = 'CA-test-chris-' + Date.now();
  const phone = '+15551234567';
  const attributes = buildTaskAttributesFor609Inbound({
    call_sid: callSid,
    phone_number: phone,
    market: 'Veteran',
    state: 'FL',
    lead_name: 'Test Call (Chris)',
    first_name: 'Test',
    last_name: 'Call',
  });

  console.log('Creating test task → Veteran, FL (should offer to chrislafond@aoglobelife.com):');
  console.log('  market: Veteran, state: FL');
  const { taskSid } = await createTask(attributes);
  console.log('Task created:', taskSid);
  console.log('');
  console.log('Chris’s browser (Call Connector Pro, logged in as chrislafond@aoglobelife.com) should show the inbound call card within a few seconds.');
  console.log('If he clicks Accept, the app will dequeue; this is a test task so no real call leg.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
