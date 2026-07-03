/**
 * Fix Chris (and any other worker) so TaskRouter can assign them voice tasks.
 * Voice capacity 0 = TaskRouter NEVER offers them the call. This script sets it to 1.
 *
 * Run: npx tsx server/scripts/fix-chris-voice-capacity.ts
 * Or fix a specific email: npx tsx server/scripts/fix-chris-voice-capacity.ts someagent@aoglobelife.com
 */
import {
  isTaskRouterConfigured,
  getWorkerSidByFriendlyName,
  getWorkerVoiceCapacity,
  setWorkerVoiceCapacity,
  listWorkers,
} from '../taskrouter-service.js';

const CHRIS_EMAIL = 'chrislafond@aoglobelife.com';

async function main() {
  if (!isTaskRouterConfigured()) {
    console.error('TaskRouter not configured.');
    process.exit(1);
  }

  const email = (process.argv[2] || CHRIS_EMAIL).trim().toLowerCase();
  console.log('Fixing voice capacity for:', email);

  const workerSid = await getWorkerSidByFriendlyName(email);
  if (!workerSid) {
    console.error('Worker not found in TaskRouter. Have them go Online in the app first.');
    process.exit(1);
  }

  const before = await getWorkerVoiceCapacity(workerSid);
  console.log('Current voice capacity:', before);

  if (before >= 1) {
    console.log('Already has capacity >= 1. No change needed.');
    return;
  }

  await setWorkerVoiceCapacity(workerSid, 1);
  const after = await getWorkerVoiceCapacity(workerSid);
  console.log('New voice capacity:', after);
  console.log('Done. TaskRouter can now assign voice tasks to', email);

  // List any other AvailableInbound workers with 0 capacity
  const all = await listWorkers({ limit: 500 });
  const zeroCap: string[] = [];
  for (const w of all) {
    if (w.activityName !== 'AvailableInbound') continue;
    const cap = await getWorkerVoiceCapacity(w.workerSid);
    if (cap < 1) zeroCap.push(w.friendlyName);
  }
  if (zeroCap.length > 0) {
    console.log('\nOther AvailableInbound workers with voice capacity 0:', zeroCap.join(', '));
    console.log('Run: npx tsx server/scripts/list-workers-voice-capacity.ts  to fix all.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
