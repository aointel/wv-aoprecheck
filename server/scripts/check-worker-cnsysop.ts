/**
 * Is cnsysop in TaskRouter? Online? What attributes?
 * Run: npx tsx server/scripts/check-worker-cnsysop.ts
 */
import { listWorkers, getWorkerSidByFriendlyName } from '../taskrouter-service.js';

const EMAIL = 'cnsysop@aoglobelife.com';

async function main() {
  const sid = await getWorkerSidByFriendlyName(EMAIL);
  if (!sid) {
    console.log('cnsysop NOT in TaskRouter (no worker with friendlyName', EMAIL + ')');
    console.log('→ Run sync-cnsysop-inbound609.ts or have them go voice-online in Call Connector Pro.');
    return;
  }
  const all = await listWorkers({ limit: 500 });
  const worker = all.find((x) => x.friendlyName === EMAIL || x.workerSid === sid);
  if (!worker) {
    console.log('Worker SID', sid, 'found but not in list');
    return;
  }
  console.log('cnsysop FOUND in TaskRouter');
  console.log('  workerSid:', worker.workerSid);
  console.log('  friendlyName:', worker.friendlyName);
  console.log('  activityName:', worker.activityName, worker.activityName === 'AvailableInbound' ? '← ONLINE for inbound' : '← not online for inbound');
  console.log('  available:', worker.available);
  let attrs: Record<string, unknown> = {};
  try {
    attrs = typeof worker.attributes === 'string' ? JSON.parse(worker.attributes) : worker.attributes || {};
  } catch (_) {}
  console.log('  attributes (markets, licensed_states, contact_uri):');
  console.log('    markets:', attrs.markets);
  console.log('    licensed_states:', attrs.licensed_states);
  console.log('    contact_uri:', attrs.contact_uri);
  console.log('  full attributes:', worker.attributes);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
