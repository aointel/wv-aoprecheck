/**
 * Fetch a task by SID and list its reservations + task channel.
 * Run: npx tsx server/scripts/check-task-reservations.ts WTxxxx
 */
import twilio from 'twilio';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_TASKROUTER_WORKSPACE_SID } from '../hardcoded-config.js';

const taskSid = process.argv[2]?.trim();
if (!taskSid || !taskSid.startsWith('WT')) {
  console.error('Usage: npx tsx server/scripts/check-task-reservations.ts WTxxxxxxxxxxxx');
  process.exit(1);
}

async function main() {
  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  const workspace = client.taskrouter.v1.workspaces(TWILIO_TASKROUTER_WORKSPACE_SID!);

  const task = await workspace.tasks(taskSid).fetch();
  const t = task as any;
  const attrs = typeof t.attributes === 'string' ? JSON.parse(t.attributes) : t.attributes || {};
  console.log('Task:', taskSid);
  console.log('  assignment_status:', t.assignmentStatus ?? t.assignment_status);
  console.log('  task_channel:', t.taskChannelUniqueName ?? t.task_channel_unique_name);
  console.log('  task_channel_sid:', t.taskChannelSid ?? t.task_channel_sid);
  console.log('  task_queue_sid:', t.taskQueueSid ?? t.task_queue_sid);
  console.log('  market:', attrs.market);
  console.log('  state:', attrs.state);
  console.log('  call_sid:', attrs.call_sid);

  const reservations = await workspace.tasks(taskSid).reservations.list();
  console.log('\nReservations:', reservations.length);
  for (const r of reservations as any[]) {
    console.log('  ', r.sid, '| worker:', r.workerSid ?? r.worker_sid, '| status:', r.reservationStatus ?? r.reservation_status);
  }
  if (reservations.length === 0) {
    console.log('\n0 reservations → TaskRouter did not offer this task to any worker.');
    console.log('Common cause: no worker with matching market/state OR worker voice channel capacity = 0.');
    console.log('Fix: npx tsx server/scripts/list-workers-voice-capacity.ts  (sets voice capacity 1 for AvailableInbound workers)');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
