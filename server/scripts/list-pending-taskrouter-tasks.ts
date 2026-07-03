/**
 * List TaskRouter tasks that are pending or reserved ("sitting" in queue).
 * Also list last 20 tasks in the inbound workflow.
 * Run: npx tsx server/scripts/list-pending-taskrouter-tasks.ts
 */
import { isTaskRouterConfigured, getWorkflowSidForEnqueue, fetchWorkspace } from '../taskrouter-service.js';
import twilio from 'twilio';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from '../hardcoded-config.js';

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
  const { sid: wsSid } = await fetchWorkspace();
  const workflowSid = getWorkflowSidForEnqueue();
  const workspace = client.taskrouter.v1.workspaces(wsSid);

  console.log('=== Pending / Reserved tasks (sitting in queue) ===\n');
  const pending = await workspace.tasks.list({
    assignmentStatus: ['pending', 'reserved'],
    limit: 20,
  });
  if (!pending || pending.length === 0) {
    console.log('No pending or reserved tasks.\n');
  } else {
    for (const t of pending as any[]) {
      const status = t.assignmentStatus ?? t.assignment_status;
      const attrs = t.attributes ?? '{}';
      let a: any = {};
      try {
        a = typeof attrs === 'string' ? JSON.parse(attrs) : attrs;
      } catch (_) {}
      const callSid = a.call_sid ?? '';
      const phone = a.phone_number ?? a.phone ?? '';
      const target = a.routing_target ?? '';
      console.log('Task:', t.sid, '| status:', status, '| call_sid:', callSid, '| phone:', phone, '| routing_target:', target);
      const reservations = await workspace.tasks(t.sid).reservations.list({ limit: 10 });
      if (reservations.length > 0) {
        for (const r of reservations as any[]) {
          const rStatus = r.reservationStatus ?? r.reservation_status;
          console.log('  Reservation:', r.sid, '| worker:', r.workerSid ?? r.worker_sid, '|', rStatus);
        }
      }
      console.log('');
    }
  }

  console.log('=== Last 20 tasks (inbound workflow) ===\n');
  const recent = await workspace.tasks.list({
    workflowSid,
    limit: 20,
  });
  if (!recent || recent.length === 0) {
    console.log('No tasks in inbound workflow.\n');
  } else {
    for (const t of recent as any[]) {
      const status = t.assignmentStatus ?? t.assignment_status;
      const created = t.dateCreated ?? t.date_created;
      const attrs = t.attributes ?? '{}';
      let a: any = {};
      try {
        a = typeof attrs === 'string' ? JSON.parse(attrs) : attrs;
      } catch (_) {}
      const callSid = a.call_sid ?? '';
      const phone = a.phone_number ?? a.phone ?? '';
      console.log(t.sid, '|', status, '|', created, '| call_sid:', callSid, '| phone:', phone);
    }
  }

  console.log('\n=== Done ===');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
