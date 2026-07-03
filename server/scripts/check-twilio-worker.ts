/**
 * List all TaskRouter workers and their attributes from Twilio.
 * Run: npx tsx server/scripts/check-twilio-worker.ts
 * Or: npx tsx server/scripts/check-twilio-worker.ts email@example.com
 */
const emailArg = process.argv[2];
const normalized = emailArg ? process.argv[2].trim().toLowerCase() : null;

async function main() {
  const { listWorkers } = await import('../taskrouter-service.js');
  const workers = await listWorkers({ limit: 5000 });
  if (normalized) {
    const worker = workers.find((w) => w.friendlyName.toLowerCase() === normalized);
    if (!worker) {
      console.log('No worker with friendlyName:', emailArg);
      return;
    }
    let attrs: Record<string, unknown> = {};
    try {
      attrs = typeof worker.attributes === 'string' ? JSON.parse(worker.attributes) : (worker.attributes || {});
    } catch (_) {}
    console.log(JSON.stringify({ workerSid: worker.workerSid, friendlyName: worker.friendlyName, activityName: worker.activityName, available: worker.available, markets: (attrs as any).markets, licensed_states: (attrs as any).licensed_states, attributes: attrs }, null, 2));
    return;
  }
  const out = workers.map((w) => {
    let attrs: Record<string, unknown> = {};
    try {
      attrs = typeof w.attributes === 'string' ? JSON.parse(w.attributes) : (w.attributes || {});
    } catch (_) {}
    return {
      workerSid: w.workerSid,
      friendlyName: w.friendlyName,
      activityName: w.activityName,
      available: w.available,
      markets: (attrs as any).markets,
      licensed_states: (attrs as any).licensed_states,
      attributes: attrs,
    };
  });
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
