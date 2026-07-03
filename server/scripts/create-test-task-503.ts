/**
 * Create one test TaskRouter task (simulated inbound) for 5032018470 so cnsysop@aoglobelife.com can see the card.
 * Run: npx tsx server/scripts/create-test-task-503.ts
 * Prereq: cnsysop@aoglobelife.com must be online (VDP or WebRTC) to receive the offer.
 */
import {
  isTaskRouterConfigured,
  buildTaskAttributesForEnqueue,
  createTask,
} from '../taskrouter-service.js';

async function main() {
  if (!isTaskRouterConfigured()) {
    console.error('TaskRouter not configured. Set workspace and workflow SIDs.');
    process.exit(1);
  }

  const attributes = buildTaskAttributesForEnqueue({
    call_sid: 'test-' + Date.now(),
    source: 'direct_inbound',
    market: 'Test',
    state: 'OR',
    phone_number: '+15032018470',
    lead_name: 'Test Call 5032018470',
  });

  console.log('Creating test task for +15032018470 (5032018470)...');
  const { taskSid } = await createTask(attributes);
  console.log('Task created:', taskSid);
  console.log('If cnsysop@aoglobelife.com is online, they should see the incoming call card.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
