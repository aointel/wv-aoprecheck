/**
 * Reset specific TaskRouter workers to Offline (clean state after a bad call flow).
 * Run: npx tsx server/scripts/reset-taskrouter-workers.ts
 *      (resets crhislafond@aoglobelife.com and cnsysops@aoglobelife.com)
 * Or:  npx tsx server/scripts/reset-taskrouter-workers.ts email1@x.com email2@x.com
 */
import { isTaskRouterConfigured, setWorkerOffline, getWorkerSidByFriendlyName } from '../taskrouter-service.js';

const DEFAULT_EMAILS = ['chrislafond@aoglobelife.com', 'cnsysop@aoglobelife.com'];

async function main() {
  if (!isTaskRouterConfigured()) {
    console.error('TaskRouter not configured.');
    process.exit(1);
  }

  const emails = process.argv.slice(2).filter((a) => a.includes('@'));
  const toReset = emails.length > 0 ? emails : DEFAULT_EMAILS;

  console.log('Resetting TaskRouter workers to Offline:', toReset.join(', '), '\n');

  for (const email of toReset) {
    const sid = await getWorkerSidByFriendlyName(email.trim().toLowerCase());
    if (!sid) {
      console.log('  Skip:', email, '(no worker with this friendlyName)');
      continue;
    }
    try {
      await setWorkerOffline(email.trim().toLowerCase());
      console.log('  OK:', email, '-> Offline');
    } catch (e) {
      console.error('  FAIL:', email, (e as Error).message);
    }
  }
  console.log('\nDone.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
