/**
 * Force-release ALL workers stuck in BusyOnCall back to AvailableInbound.
 * Use when agents show "on call" but aren't — e.g. status callback never fired or client never sent voice-online.
 * Run: npx tsx server/scripts/release-stuck-workers-taskrouter.ts
 * Optional: npx tsx server/scripts/release-stuck-workers-taskrouter.ts email1@x.com email2@x.com  (release only those)
 */
import { isTaskRouterConfigured, listWorkers, setWorkerActivityToAvailableInbound } from '../taskrouter-service.js';

async function main() {
  if (!isTaskRouterConfigured()) {
    console.error('TaskRouter not configured.');
    process.exit(1);
  }

  const onlyThese = process.argv.slice(2).filter((a) => a.includes('@'));
  if (onlyThese.length > 0) {
    console.log('Releasing only:', onlyThese.join(', '));
    for (const email of onlyThese) {
      try {
        await setWorkerActivityToAvailableInbound(email);
        console.log('OK:', email, '-> AvailableInbound');
      } catch (e) {
        console.error('FAIL:', email, (e as Error).message);
      }
    }
    console.log('Done.');
    return;
  }

  const all = await listWorkers({ limit: 500 });
  const busy = all.filter((w) => w.activityName === 'BusyOnCall');
  if (busy.length === 0) {
    console.log('No workers in BusyOnCall.');
    return;
  }
  console.log(`Found ${busy.length} worker(s) in BusyOnCall — releasing to AvailableInbound...`);
  for (const w of busy) {
    const email = w.friendlyName?.trim() || w.workerSid;
    try {
      await setWorkerActivityToAvailableInbound(email);
      console.log('OK:', email, '-> AvailableInbound');
    } catch (e) {
      console.error('FAIL:', email, (e as Error).message);
    }
  }
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
