/**
 * Test how inbound calls get routed: create a Task in TaskRouter (same as Enqueue).
 * TaskRouter will run the workflow and POST to your assignment callback for each worker offered.
 *
 * Prereqs:
 * - Server running with a PUBLIC URL (Twilio must reach assignment callback).
 * - At least one worker online (Power On in app so they're AvailableInbound).
 *
 * Run: npx tsx server/scripts/test-taskrouter-routing.ts
 * Optional: BASE_URL=https://your-app.up.railway.app npx tsx server/scripts/test-taskrouter-routing.ts
 *
 * After running:
 * 1. Check server logs for "TaskRouter assignment: task=... worker=... reservation=..."
 * 2. GET {BASE_URL}/api/twilio/taskrouter/pending to see offered reservations (or ?agentEmail=... to filter).
 * 3. In the app, the agent should see the incoming offer and can Accept (or POST /api/twilio/taskrouter/accept with taskSid + reservationSid).
 */

import {
  isTaskRouterConfigured,
  getWorkflowSidForEnqueue,
  buildTaskAttributesForEnqueue,
  createTask,
  listWorkers,
} from '../taskrouter-service.js';

const BASE_URL = process.env.BASE_URL || 'https://aoirail-production.up.railway.app';

async function main() {
  if (!isTaskRouterConfigured()) {
    console.error('TaskRouter not configured. Set workspace and workflow SIDs.');
    process.exit(1);
  }

  const online = await listWorkers({ availableOnly: true, limit: 10 });
  if (online.length === 0) {
    console.warn('No workers online. Power on WebRTC in the app for at least one agent, then run again.');
  } else {
    console.log('Online workers (will be offered the task):', online.length);
    online.forEach((w) => console.log('  ', w.friendlyName));
    console.log('');
  }

  const workflowSid = getWorkflowSidForEnqueue();
  const attributes = buildTaskAttributesForEnqueue({
    call_sid: 'test-' + Date.now(),
    source: 'direct_inbound',
    market: 'Test',
    state: 'XX',
    phone_number: '+15551234567',
    lead_name: 'Test Caller',
  });

  console.log('Creating task (simulated inbound call)...');
  const { taskSid } = await createTask(attributes);
  console.log('Task created:', taskSid);
  console.log('');
  console.log('Next:');
  console.log('  1. Twilio will call your assignment callback (server must be reachable at', BASE_URL + ')');
  console.log('  2. Check server logs for "TaskRouter assignment: task=..."');
  console.log('  3. List pending offers: GET', BASE_URL + '/api/twilio/taskrouter/pending');
  console.log('  4. In the app, agent sees the incoming offer and can Accept');
  console.log('     Or accept via API: POST', BASE_URL + '/api/twilio/taskrouter/accept');
  console.log('       Body: { "taskSid": "' + taskSid + '", "reservationSid": "<from pending>" }');
  console.log('');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
