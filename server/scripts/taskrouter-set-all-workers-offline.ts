/**
 * Set every TaskRouter worker to Offline (not available).
 * Run: npx tsx server/scripts/taskrouter-set-all-workers-offline.ts
 */
import { setAllWorkersOffline } from '../taskrouter-service.js';

async function main() {
  console.log('Setting every TaskRouter worker to Offline (paginating all pages)...\n');
  const result = await setAllWorkersOffline();
  console.log('Total workers:', result.total, '→ Updated:', result.updated, 'Skipped (already Offline):', result.skipped, 'Errors:', result.errors);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
