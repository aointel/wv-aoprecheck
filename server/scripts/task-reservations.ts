/**
 * List reservations for a TaskRouter task (who was offered, accepted, rejected, timeout).
 * Run: npx tsx server/scripts/task-reservations.ts <TaskSid>
 *      npx tsx server/scripts/task-reservations.ts   (uses last 609 call's task)
 */
import twilio from 'twilio';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_TASKROUTER_WORKSPACE_SID } from '../hardcoded-config.js';

async function main() {
  let taskSid = process.argv[2]?.trim();
  if (!taskSid && TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
    const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    const calls = await client.calls.list({ to: '+16096048379', limit: 1 });
    if (calls.length === 0) {
      console.error('No 609 calls found. Pass task SID: npx tsx server/scripts/task-reservations.ts WT...');
      process.exit(1);
    }
    const callSid = calls[0].sid;
    const { listRecentTasks } = await import('../taskrouter-service.js');
    const tasks = await listRecentTasks({ limit: 20 });
    const task = tasks.find((t) => {
      try {
        const a = typeof t.attributes === 'string' ? JSON.parse(t.attributes) : t.attributes || {};
        return (a.call_sid || a.callSid) === callSid;
      } catch {
        return false;
      }
    });
    if (!task) {
      console.error('No task found for last 609 call. Pass task SID: npx tsx server/scripts/task-reservations.ts WT...');
      process.exit(1);
    }
    taskSid = task.sid;
    console.log('Using task for last 609 call:', taskSid, '\n');
  }
  if (!taskSid?.startsWith('WT')) {
    console.error('Usage: npx tsx server/scripts/task-reservations.ts <TaskSid>');
    process.exit(1);
  }

  const workspaceSid = TWILIO_TASKROUTER_WORKSPACE_SID || process.env.TWILIO_TASKROUTER_WORKSPACE_SID;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !workspaceSid) {
    console.error('Missing Twilio or TaskRouter config');
    process.exit(1);
  }

  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  const reservations = await client.taskrouter.v1
    .workspaces(workspaceSid)
    .tasks(taskSid)
    .reservations.list();

  console.log('Task:', taskSid);
  console.log('Reservations:', reservations.length);
  if (reservations.length === 0) {
    console.log('No reservations → assignment callback was never invoked or no workers matched.');
    return;
  }
  for (const r of reservations as any[]) {
    const status = r.reservationStatus ?? r.reservation_status ?? r.status;
    const workerSid = r.workerSid ?? r.worker_sid;
    const sid = r.sid;
    let workerName = workerSid;
    if (workerSid) {
      try {
        const w = await client.taskrouter.v1.workspaces(workspaceSid).workers(workerSid).fetch();
        workerName = (w as any).friendlyName ?? (w as any).friendly_name ?? workerSid;
        const attrs = typeof (w as any).attributes === 'string' ? JSON.parse((w as any).attributes) : (w as any).attributes || {};
        const email = attrs.agent_email ?? attrs.email ?? '';
        if (email) workerName += ' (' + email + ')';
      } catch (_) {}
    }
    console.log('  ', sid, '| worker:', workerName, '| status:', status);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
