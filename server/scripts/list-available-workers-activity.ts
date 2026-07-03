/**
 * List workers with available=true and their activity name (to see if they're AvailableInbound).
 * Run: npx tsx server/scripts/list-available-workers-activity.ts
 */
import twilio from 'twilio';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_TASKROUTER_WORKSPACE_SID } from '../hardcoded-config.js';

async function main() {
  const client = twilio(TWILIO_ACCOUNT_SID!, TWILIO_AUTH_TOKEN!);
  const ws = client.taskrouter.v1.workspaces(TWILIO_TASKROUTER_WORKSPACE_SID!);
  const list = await ws.workers.list({ available: 'true', limit: 30 });
  console.log('Workers with available=true:', list.length);
  for (const w of list as any[]) {
    const name = w.friendlyName ?? w.friendly_name ?? w.sid;
    const act = w.activityName ?? w.activity_name ?? w.activitySid ?? '?';
    console.log('  ', name, '| activity:', act);
  }
  const inbound = list.filter((w: any) => (w.activityName || w.activity_name || '').includes('AvailableInbound'));
  console.log('\nOf these, in AvailableInbound:', inbound.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
