/**
 * Who is online for inbound right now (activity = AvailableInbound)?
 * Run: npx tsx server/scripts/who-is-online.ts
 */
import { listWorkers } from '../taskrouter-service.js';

async function main() {
  const workers = await listWorkers({ activityName: 'AvailableInbound', limit: 100 });
  console.log('Online for inbound (AvailableInbound):', workers.length);
  for (const w of workers) {
    let email = w.friendlyName;
    try {
      const attrs = typeof w.attributes === 'string' ? JSON.parse(w.attributes) : w.attributes || {};
      email = (attrs.agent_email || attrs.email || w.friendlyName) as string;
    } catch (_) {}
    console.log(' ', email);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
