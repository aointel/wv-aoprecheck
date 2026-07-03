/**
 * Put an agent in Offline state for TaskRouter (same as clicking Offline in the app).
 * Sets the Worker's activity to Offline so they do not receive 609 inbound calls.
 *
 * Run: npx tsx server/scripts/set-agent-offline-taskrouter.ts [email]
 * Default email: chrislafond@aoglobelife.com
 */
import {
  isTaskRouterConfigured,
  setWorkerOffline,
} from '../taskrouter-service';

const DEFAULT_EMAIL = 'chrislafond@aoglobelife.com';

async function main() {
  const email = (process.argv[2] || DEFAULT_EMAIL).trim().toLowerCase();
  if (!email || !email.includes('@')) {
    console.error('Usage: npx tsx server/scripts/set-agent-offline-taskrouter.ts [email]');
    process.exit(1);
  }

  if (!isTaskRouterConfigured()) {
    console.error('TaskRouter not configured.');
    process.exit(1);
  }

  await setWorkerOffline(email);
  console.log('OK:', email, 'is now Offline in TaskRouter. They will not receive 609 inbound calls.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
