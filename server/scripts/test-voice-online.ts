/**
 * Test that TaskRouter receives "agent online" — set one agent to AvailableInbound and list online workers.
 * Usage: npx tsx server/scripts/test-voice-online.ts [email]
 * Example: npx tsx server/scripts/test-voice-online.ts chrislafond@aoglobelife.com
 */
import { setWorkerAvailableForVoice, listWorkers } from '../taskrouter-service.js';

const email = process.argv[2]?.trim() || 'chrislafond@aoglobelife.com';
if (!email.includes('@')) {
  console.error('Usage: npx tsx server/scripts/test-voice-online.ts <email>');
  process.exit(1);
}

async function main() {
  console.log('Setting', email, 'to AvailableInbound in TaskRouter...');
  try {
    const { workerSid } = await setWorkerAvailableForVoice(email, null);
    console.log('OK — worker updated:', workerSid);
  } catch (e) {
    console.error('Failed to set online:', e);
    process.exit(1);
  }

  console.log('\nListing online workers (availableOnly: true):');
  const online = await listWorkers({ availableOnly: true, limit: 50 });
  console.log('Count:', online.length);
  online.forEach((w) => {
    console.log(' -', w.friendlyName, w.activityName, w.workerSid);
  });
  if (online.length === 0) {
    console.log('(None — Twilio filter may differ; listing all workers with AvailableInbound by name...)');
    const all = await listWorkers({ limit: 5000 });
    const available = all.filter((w) => w.activityName === 'AvailableInbound');
    console.log('Workers in AvailableInbound:', available.length);
    available.forEach((w) => console.log(' -', w.friendlyName));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
