/**
 * List TaskRouter workers who are available to take calls (activity = available).
 * Usage: npx tsx server/scripts/list-available-workers.ts
 */

import { listWorkers } from '../taskrouter-service.js';

async function main() {
  const available = await listWorkers({ availableOnly: true, limit: 10000 });
  const all = await listWorkers({ limit: 10000 });

  console.log('--- Available to take calls (TaskRouter activity = available) ---');
  if (available.length === 0) {
    console.log('(none)');
  } else {
    for (const w of available) {
      let attrs: Record<string, unknown> = {};
      try {
        attrs = JSON.parse(w.attributes || '{}') as Record<string, unknown>;
      } catch {
        // ignore
      }
      const email = (attrs.email ?? attrs.agent_email ?? w.friendlyName) as string;
      const markets = (attrs.markets as string[] | undefined) ?? [];
      const states = (attrs.licensed_states as string[] | undefined) ?? [];
      const target = (attrs.routing_target as string | undefined) ?? '';
      console.log(`  ${email}  activity=${w.activityName}  routing_target=${target}  markets=[${markets.join(', ')}]  states=[${states.join(', ')}]`);
    }
  }

  console.log('');
  console.log('--- All workers (by activity) ---');
  const byActivity = new Map<string, typeof all>();
  for (const w of all) {
    const list = byActivity.get(w.activityName) ?? [];
    list.push(w);
    byActivity.set(w.activityName, list);
  }
  for (const [activityName, workers] of [...byActivity.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`  ${activityName}: ${workers.length}`);
    for (const w of workers) {
      let attrs: Record<string, unknown> = {};
      try {
        attrs = JSON.parse(w.attributes || '{}') as Record<string, unknown>;
      } catch {
        // ignore
      }
      const email = (attrs.email ?? attrs.agent_email ?? w.friendlyName) as string;
      console.log(`    - ${email}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
