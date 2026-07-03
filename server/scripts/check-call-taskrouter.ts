/**
 * Check what TaskRouter did for a specific inbound call (no server logs needed).
 * Finds the task created for this call and its reservations (did we offer to a worker? what status?).
 *
 * Run: npx tsx server/scripts/check-call-taskrouter.ts <CallSid>
 * Example: npx tsx server/scripts/check-call-taskrouter.ts CA7dacf61c96a72c1fa481e2e1ce782655
 */
import { isTaskRouterConfigured, fetchWorkspace } from '../taskrouter-service.js';
import twilio from 'twilio';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from '../hardcoded-config.js';

const callSid = process.argv[2]?.trim();
if (!callSid || !callSid.startsWith('CA')) {
  console.error('Usage: npx tsx server/scripts/check-call-taskrouter.ts <CallSid>');
  process.exit(1);
}

async function main() {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error('Missing Twilio credentials');
    process.exit(1);
  }
  if (!isTaskRouterConfigured()) {
    console.error('TaskRouter not configured');
    process.exit(1);
  }

  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  const ws = await fetchWorkspace();
  const workspace = client.taskrouter.v1.workspaces(ws.sid);

  console.log('Call SID:', callSid);
  console.log('Searching recent tasks for task with this call_sid...\n');

  const tasks = await workspace.tasks.list({ limit: 50 });
  let found: any = null;
  for (const t of tasks) {
    const attrs = (t as any).attributes ?? '{}';
    let a: any = {};
    try {
      a = typeof attrs === 'string' ? JSON.parse(attrs) : attrs;
    } catch (_) {}
    if (a.call_sid === callSid) {
      found = t;
      break;
    }
  }

  if (!found) {
    console.log('No TaskRouter task found for this call.');
    console.log('Either the call never hit Enqueue (webrtc returned something else), or the task is older than the last 50 tasks.');
    process.exit(0);
  }

  const t = found as any;
  const taskSid = t.sid;
  const assignmentStatus = t.assignmentStatus ?? t.assignment_status ?? t.status;
  const dateCreated = t.dateCreated ?? t.date_created;
  const attrs = t.attributes ?? '{}';
  let a: any = {};
  try {
    a = typeof attrs === 'string' ? JSON.parse(attrs) : attrs;
  } catch (_) {}

  console.log('--- Task ---');
  console.log('Task SID:', taskSid);
  console.log('Assignment status:', assignmentStatus);
  console.log('Created:', dateCreated);
  console.log('Call SID in attributes:', a.call_sid);
  console.log('');

  const reservations = await workspace.tasks(taskSid).reservations.list({ limit: 20 });
  console.log('--- Reservations (offers to workers) ---');
  console.log('Count:', reservations.length);
  if (reservations.length === 0) {
    console.log('No reservations. So TaskRouter never offered this task to any worker.');
    console.log('Common cause: no workers in AvailableInbound, or voice channel capacity 0.');
  } else {
    for (const r of reservations as any[]) {
      const resStatus = r.reservationStatus ?? r.reservation_status;
      const workerSid = r.workerSid ?? r.worker_sid;
      console.log('  Reservation:', r.sid, '| worker:', workerSid, '| status:', resStatus);
    }
  }
  console.log('\n=== Done ===');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
