/**
 * List workers in the TaskRouter workspace.
 * Run: npx tsx server/scripts/list-taskrouter-workers.ts          -- all workers
 * Run: npx tsx server/scripts/list-taskrouter-workers.ts --online -- online only
 */

import { listWorkers } from '../taskrouter-service.js';

async function main() {
  const onlineOnly = process.argv.includes('--online');
  const workers = await listWorkers({ availableOnly: onlineOnly, limit: 10000 });
  console.log(onlineOnly ? 'Online workers (available for inbound):' : 'Workers in TaskRouter workspace:', workers.length);
  if (workers.length === 0) {
    console.log(onlineOnly
      ? '(No one online. Power on WebRTC in the app so device.registered fires and POST /api/agents/voice-online runs.)'
      : '(No workers yet. Sync agents via sync-taskrouter-workers.)');
    return;
  }
  workers.forEach((w) => {
    const attrs = (() => {
      try {
        return JSON.parse(w.attributes || '{}');
      } catch {
        return {};
      }
    })();
    console.log({
      sid: w.workerSid,
      friendlyName: w.friendlyName,
      activityName: w.activityName,
      available: w.available,
      ...(attrs.agent_id && { agent_id: attrs.agent_id }),
      ...(attrs.markets && { markets: attrs.markets }),
      ...(attrs.licensed_states && { licensed_states: attrs.licensed_states }),
    });
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
