/**
 * List all TaskRouter workers with their activity and VOICE CHANNEL CAPACITY.
 * If workers are AvailableInbound but voice capacity is 0, TaskRouter will NOT offer them tasks — call won't be routed.
 *
 * Run: npx tsx server/scripts/list-workers-voice-capacity.ts
 */
import {
  isTaskRouterConfigured,
  listWorkers,
  getWorkerVoiceCapacity,
  setWorkerVoiceCapacity,
} from '../taskrouter-service.js';

async function main() {
  console.log('=== TaskRouter workers: activity + voice capacity ===\n');

  if (!isTaskRouterConfigured()) {
    console.log('❌ TaskRouter not configured.');
    process.exit(1);
  }

  const all = await listWorkers({ limit: 200 });
  console.log('Workers:', all.length);
  if (all.length === 0) {
    console.log('No workers. Sync via voice-online (go Online in app) or sync-taskrouter-workers.');
    return;
  }

  let fixed = 0;
  for (const w of all) {
    const capacity = await getWorkerVoiceCapacity(w.workerSid);
    const ok = capacity >= 1 ? '✅' : '❌';
    const capStr = capacity >= 1 ? `capacity=${capacity}` : 'capacity=0 (will NOT receive voice tasks)';
    console.log(`${ok} ${w.friendlyName}  activity=${w.activityName}  voice ${capStr}`);

    // Auto-fix: if available for inbound but capacity 0, set to 1
    if (w.activityName === 'AvailableInbound' && capacity < 1) {
      try {
        await setWorkerVoiceCapacity(w.workerSid, 1);
        console.log(`   → set voice capacity to 1`);
        fixed++;
      } catch (e) {
        console.log(`   → failed to set capacity:`, (e as Error).message);
      }
    }
  }

  if (fixed > 0) {
    console.log(`\nFixed ${fixed} worker(s): voice capacity set to 1. They can now receive inbound calls.`);
  }
  console.log('\n=== Done ===');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
