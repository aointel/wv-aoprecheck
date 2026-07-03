/**
 * Confirm TaskRouter requirements for receiving 609 voice calls.
 * Prints a checklist and checks the given agent (default: cnsysop).
 *
 * Requirements (all must be true):
 *  1. Worker exists in TaskRouter (friendlyName = agent email)
 *  2. Activity = AvailableInbound (online for inbound)
 *  3. Worker has voice worker channel with configured capacity >= 1
 *  4. Worker attributes include contact_uri (client:email) and routing_target/markets/licensed_states for matching
 *
 * Run: npx tsx server/scripts/confirm-taskrouter-voice-requirements.ts
 *      npx tsx server/scripts/confirm-taskrouter-voice-requirements.ts cnsysop@aoglobelife.com
 */
import {
  isTaskRouterConfigured,
  listWorkers,
  getWorkerVoiceCapacity,
  setWorkerVoiceCapacity,
  getWorkerSidByFriendlyName,
} from '../taskrouter-service.js';

const DEFAULT_EMAIL = 'cnsysop@aoglobelife.com';

function main() {
  const email = (process.argv[2] || DEFAULT_EMAIL).trim().toLowerCase();
  return run(email);
}

async function run(email: string) {
  console.log('=== TaskRouter voice requirements (609 inbound) ===\n');
  console.log('To receive voice calls a worker MUST have:\n');
  console.log('  1. Worker exists (friendlyName = agent email)');
  console.log('  2. Activity = AvailableInbound');
  console.log('  3. Voice channel configured capacity >= 1  ← If 0, TaskRouter NEVER offers voice tasks');
  console.log('  4. contact_uri = client:<email> (for dequeue to ring the browser)');
  console.log('  5. markets / licensed_states match task (or task has Unknown/XX)\n');
  console.log(`Checking: ${email}\n`);

  if (!isTaskRouterConfigured()) {
    console.log('❌ TaskRouter not configured (workspace/workflow SIDs + Twilio creds).');
    process.exit(1);
  }

  const workerSid = await getWorkerSidByFriendlyName(email);
  if (!workerSid) {
    console.log('❌ Worker does NOT exist in TaskRouter.');
    console.log('   → Have them go Online (WebRTC) in the app, or run: npx tsx server/scripts/sync-cnsysop-inbound609.ts');
    process.exit(1);
  }
  console.log('✅ 1. Worker exists');

  const all = await listWorkers({ limit: 500 });
  const worker = all.find((w) => w.workerSid === workerSid || w.friendlyName === email);
  if (!worker) {
    console.log('❌ Worker SID found but not in list.');
    process.exit(1);
  }

  const isAvailable = worker.activityName === 'AvailableInbound' && worker.available;
  if (!isAvailable) {
    console.log('❌ 2. Activity is not AvailableInbound (or not available).');
    console.log(`   Current: activity=${worker.activityName} available=${worker.available}`);
    console.log('   → Have them go Online (WebRTC) in the app.');
  } else {
    console.log('✅ 2. Activity = AvailableInbound');
  }

  const voiceCapacity = await getWorkerVoiceCapacity(workerSid);
  if (voiceCapacity < 1) {
    console.log('❌ 3. Voice channel capacity is 0 — TaskRouter will NOT offer this worker voice tasks.');
    try {
      await setWorkerVoiceCapacity(workerSid, 1);
      console.log('   → Fixed: set voice capacity to 1. Run this script again to confirm.');
    } catch (e) {
      console.log('   → Fix failed:', (e as Error).message);
      console.log('   → Run: npx tsx server/scripts/list-workers-voice-capacity.ts');
    }
  } else {
    console.log(`✅ 3. Voice channel capacity = ${voiceCapacity}`);
  }

  let attrs: Record<string, unknown> = {};
  try {
    attrs = typeof worker.attributes === 'string' ? JSON.parse(worker.attributes) : worker.attributes || {};
  } catch (_) {}
  const contactUri = (attrs.contact_uri as string) || '';
  const hasContactUri = contactUri.toLowerCase() === `client:${email}` || (!!contactUri && contactUri.startsWith('client:'));
  if (!hasContactUri) {
    console.log('❌ 4. contact_uri missing or wrong (need client:' + email + ')');
    console.log('   Got:', contactUri || '(none)');
  } else {
    console.log('✅ 4. contact_uri =', contactUri);
  }
  console.log('   markets:', attrs.markets);
  console.log('   licensed_states:', attrs.licensed_states);

  const allGood = isAvailable && voiceCapacity >= 1 && hasContactUri;
  console.log('');
  if (allGood) {
    console.log('=== All TaskRouter voice requirements are met for', email, '===');
  } else {
    console.log('=== One or more requirements are NOT met — fix above then re-run. ===');
    console.log('   Optional: npx tsx server/scripts/list-workers-voice-capacity.ts  (fix all online workers with 0 capacity)');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
