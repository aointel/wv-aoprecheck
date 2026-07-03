/**
 * List TaskRouter reservations (task assignments) for a worker by name.
 * Shows WHEN TaskRouter last assigned this worker (and recent history).
 * Run: npx tsx server/scripts/worker-reservations.ts [name]
 * Example: npx tsx server/scripts/worker-reservations.ts scott
 *          npx tsx server/scripts/worker-reservations.ts mroeman
 */

import { listWorkers, listWorkerReservations } from '../taskrouter-service.js';
import { TASKROUTER_WORKSPACE_SID_TERMINAL } from '../config.js';

async function main() {
  const listOnly = process.argv[2]?.toLowerCase() === 'list';
  const search = (listOnly ? process.argv[3] : process.argv[2])?.toLowerCase().trim() || (listOnly ? '' : 'scott');

  // Use 1000 in case workspace has more than 500 workers (we might have missed Scott on a second page)
  const workers = await listWorkers({ limit: 1000, workspaceSid: TASKROUTER_WORKSPACE_SID_TERMINAL });

  if (listOnly) {
    const filter = (search || '').replace(/[^a-z0-9]/g, '');
    const matches = filter.length >= 1
      ? workers.filter((w) => (w.friendlyName || '').toLowerCase().replace(/[^a-z0-9]/g, '').includes(filter))
      : workers;
    console.log(`Total workers in workspace: ${workers.length}`);
    console.log(`Workers matching "${search || '(all)'}": ${matches.length}\n`);
    matches.slice(0, 100).forEach((w) => console.log(w.friendlyName, w.activityName, w.workerSid));
    if (matches.length > 100) console.log(`... and ${matches.length - 100} more`);
    return;
  }

  console.log(`=== TaskRouter: reservations for worker matching "${search}" ===\n`);

  // Match email or name (e.g. "scott", "mroeman", "scottmroeman" match scottmroeman@...)
  const searchNorm = search.replace(/[^a-z0-9]/g, '');
  const matches = workers.filter((w) => {
    const name = (w.friendlyName || '').toLowerCase();
    const nameNorm = name.replace(/[^a-z0-9]/g, '');
    return name.includes(search) || (searchNorm.length >= 2 && nameNorm.includes(searchNorm));
  });

  if (matches.length === 0) {
    console.log(`No worker found matching "${search}".`);
    console.log('Tip: use email part or name, e.g. scott, mroeman, scottmroeman@...');
    process.exit(1);
  }

  for (const worker of matches) {
    console.log(`Worker: ${worker.friendlyName}`);
    console.log(`  SID: ${worker.workerSid}  Activity: ${worker.activityName}\n`);

    const reservations = await listWorkerReservations({
      workerSid: worker.workerSid,
      workspaceSid: TASKROUTER_WORKSPACE_SID_TERMINAL,
      limit: 50,
    });

    // Sort by dateCreated descending (most recent first)
    const sorted = [...reservations].sort(
      (a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime()
    );

    if (sorted.length === 0) {
      console.log('  No reservations (TaskRouter has never assigned this worker in this workspace).');
      console.log('  If they are getting calls, those may be coming from another system (e.g. direct dial, another workspace, or AOI/WebRTC routing).\n');
      continue;
    }

    const last = sorted[0];
    console.log(`  LAST TIME TASKROUTER ASSIGNED HIM/HER: ${last.dateCreated} (${last.reservationStatus})`);
    console.log(`  Task SID: ${last.taskSid}\n`);
    console.log('  Recent reservations (most recent first):');
    sorted.slice(0, 20).forEach((r, i) => {
      console.log(`    ${i + 1}. ${r.dateCreated}  status=${r.reservationStatus}  task=${r.taskSid}`);
    });
    if (sorted.length > 20) console.log(`    ... and ${sorted.length - 20} more`);
    console.log('');
  }

  console.log('=== Done ===');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
