/**
 * Debug why Globe Market + WA task gets 0 reservations.
 * Creates task, fetches it and workflow config, prints what Twilio sees.
 * Run: npx tsx server/scripts/debug-taskrouter-wa-globe.ts
 */
import {
  isTaskRouterConfigured,
  buildTaskAttributesFor609Inbound,
  createTask,
  fetchTask,
  getWorkflowSidForEnqueue,
} from '../taskrouter-service.js';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_TASKROUTER_WORKSPACE_SID } from '../hardcoded-config.js';
import twilio from 'twilio';

async function main() {
  if (!isTaskRouterConfigured()) {
    console.error('TaskRouter not configured.');
    process.exit(1);
  }
  const workspaceSid = TWILIO_TASKROUTER_WORKSPACE_SID!;
  const client = twilio(TWILIO_ACCOUNT_SID!, TWILIO_AUTH_TOKEN!);
  const workspace = client.taskrouter.v1.workspaces(workspaceSid);

  const attributes = buildTaskAttributesFor609Inbound({
    call_sid: 'CA-debug-' + Date.now(),
    phone_number: '+15551234567',
    market: 'Globe Market',
    state: 'WA',
    lead_name: 'Test',
  });

  const { taskSid } = await createTask(attributes);
  console.log('Created task:', taskSid);

  const task = await fetchTask(taskSid);
  const attrs = typeof task.attributes === 'string' ? JSON.parse(task.attributes) : task.attributes;
  console.log('\nTask attributes (what Twilio has):', JSON.stringify(attrs, null, 2));
  console.log('  task.market =', attrs.market, '  task.state =', attrs.state);

  const workflowSid = getWorkflowSidForEnqueue();
  const wf = await workspace.workflows(workflowSid).fetch();
  const config = typeof (wf as any).configuration === 'string' ? JSON.parse((wf as any).configuration) : (wf as any).configuration;
  const filter = config?.task_routing?.filters?.[0];
  const firstTarget = filter?.targets?.[0];
  console.log('\nWorkflow first filter target expression:', firstTarget?.expression ?? '(missing)');

  const tqList = await workspace.taskQueues.list({ limit: 5 });
  for (const tq of tqList as any[]) {
    console.log('TaskQueue', tq.friendlyName, 'targetWorkers:', tq.targetWorkers ?? tq.target_workers);
  }

  console.log('\nWaiting 6s then fetching task and reservations...');
  await new Promise((r) => setTimeout(r, 6000));
  const taskAfter = await workspace.tasks(taskSid).fetch();
  const t = taskAfter as any;
  console.log('Task after 6s:', {
    assignment_status: t.assignmentStatus ?? t.assignment_status,
    task_queue_sid: t.taskQueueSid ?? t.task_queue_sid,
    task_channel: t.taskChannelUniqueName ?? t.task_channel_unique_name,
  });
  const reservations = await workspace.tasks(taskSid).reservations.list();
  console.log('Reservations:', reservations.length);
  if (reservations.length > 0) {
    for (const r of reservations as any[]) {
      console.log('  ', r.sid, r.reservationStatus ?? r.reservation_status, r.workerSid ?? r.worker_sid);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
