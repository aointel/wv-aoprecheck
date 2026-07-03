/**
 * Fetch cnsysop worker from Twilio TaskRouter and print raw API response.
 * No our logic — just what Twilio returns.
 * Run: npx tsx server/scripts/check-worker-raw-twilio.ts
 */
import twilio from 'twilio';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_TASKROUTER_WORKSPACE_SID } from '../hardcoded-config.js';

const EMAIL = 'cnsysop@aoglobelife.com';

async function main() {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_TASKROUTER_WORKSPACE_SID) {
    console.error('Missing Twilio or TaskRouter config');
    process.exit(1);
  }

  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  const workspace = client.taskrouter.v1.workspaces(TWILIO_TASKROUTER_WORKSPACE_SID);

  const list = await workspace.workers.list({ friendlyName: EMAIL, limit: 1 });
  if (list.length === 0) {
    console.log('No worker with friendlyName:', EMAIL);
    process.exit(1);
  }

  const worker = list[0];
  // Raw payload: what Twilio returns (convert to plain object so we see everything)
  const raw: Record<string, unknown> = {
    sid: worker.sid,
    friendlyName: worker.friendlyName,
    activitySid: worker.activitySid,
    activityName: worker.activityName,
    available: worker.available,
    attributes: worker.attributes,
  };
  console.log('--- Raw Twilio worker resource (cnsysop@aoglobelife.com) ---');
  console.log(JSON.stringify(raw, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
