/**
 * Check Twilio TaskRouter config and state: workspace, workflow, task queues (inbound), activities, workers.
 * Run: npx tsx server/scripts/check-taskrouter.ts
 */

import twilio from 'twilio';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from '../hardcoded-config.js';
import {
  isTaskRouterConfigured,
  fetchWorkspace,
  listActivities,
  listWorkers,
  getWorkflowSidForEnqueue,
} from '../taskrouter-service.js';

async function main() {
  console.log('=== TaskRouter check ===\n');

  if (!isTaskRouterConfigured()) {
    console.log('❌ TaskRouter not configured. Set TWILIO_TASKROUTER_WORKSPACE_SID and TWILIO_TASKROUTER_WORKFLOW_INBOUND_SID (and Twilio account credentials).');
    process.exit(1);
  }
  console.log('✅ TaskRouter configured\n');

  const ws = await fetchWorkspace();
  console.log('Workspace:', ws.sid, ws.friendlyName);

  const workflowSid = getWorkflowSidForEnqueue();
  console.log('Workflow (for Enqueue):', workflowSid);

  const client = twilio(TWILIO_ACCOUNT_SID!, TWILIO_AUTH_TOKEN!);
  const workspace = client.taskrouter.v1.workspaces(ws.sid);

  const taskQueues = await workspace.taskQueues.list({ limit: 50 });
  console.log('\nTaskQueues (inbound queue for calls):', taskQueues.length);
  if (taskQueues.length === 0) {
    console.log('  ❌ NO TASK QUEUES. Run: npx tsx server/scripts/provision-taskrouter.ts');
  } else {
    for (const tq of taskQueues as any[]) {
      const name = tq.friendlyName ?? tq.friendly_name ?? tq.sid;
      const target = tq.targetWorkers ?? tq.target_workers ?? '';
      console.log('  ', tq.sid, name, '| targetWorkers:', target);
    }
  }

  try {
    const wf = await workspace.workflows(workflowSid).fetch();
    const config = (wf as any).configuration;
    const parsed = typeof config === 'string' ? JSON.parse(config) : config;
    const assignmentUrl = (wf as any).assignmentCallbackUrl ?? (wf as any).assignment_callback_url ?? '';
    const reservationTimeout = (wf as any).taskReservationTimeout ?? (wf as any).task_reservation_timeout ?? '?';
    console.log('\nWorkflow assignment callback:', assignmentUrl || '(not set)');
    console.log('Workflow taskReservationTimeout (seconds):', reservationTimeout, reservationTimeout === 90 ? '✅ (agents ring 90s)' : reservationTimeout < 30 ? '⚠️ TOO LOW – run provision-taskrouter.ts to set 90' : '');
    const firstTargetTimeout = parsed?.task_routing?.filters?.[0]?.targets?.[0]?.timeout;
    console.log('First target timeout (seconds):', firstTargetTimeout ?? '(none)', firstTargetTimeout === 90 ? '✅ (609 ring duration)' : (firstTargetTimeout != null && firstTargetTimeout < 30 ? '⚠️ Should be 90 for 609 ring duration' : ''));
    if (parsed?.task_routing?.filters?.length) {
      console.log('Workflow filters (route to queue):', parsed.task_routing.filters.length);
      parsed.task_routing.filters.forEach((f: any, i: number) => {
        console.log('  ', i + 1, f.filter_friendly_name ?? f.expression, '-> queue:', f.targets?.[0]?.queue ?? '?');
      });
    }
    if (parsed?.task_routing?.default_filter?.queue) {
      console.log('Default filter queue:', parsed.task_routing.default_filter.queue);
    }
  } catch (e: any) {
    console.log('\nWorkflow fetch failed:', e?.message ?? e);
  }
  console.log('');

  const activities = await listActivities();
  console.log('Activities:', activities.length);
  activities.forEach((a) => {
    console.log('  ', a.friendlyName, a.available ? '(available)' : '', a.sid);
  });
  console.log('');

  const allWorkers = await listWorkers({ limit: 500 });
  const onlineWorkers = await listWorkers({ availableOnly: true, limit: 500 });
  console.log('Workers: total', allWorkers.length, '| online (AvailableInbound):', onlineWorkers.length);
  if (onlineWorkers.length > 0) {
    onlineWorkers.forEach((w) => {
      console.log('  ', w.friendlyName, w.activityName, w.workerSid);
    });
  } else if (allWorkers.length > 0) {
    console.log('  (No one online. Power on WebRTC in the app so POST /api/agents/voice-online runs.)');
  } else {
    console.log('  (No workers yet. Run: npx tsx server/scripts/sync-taskrouter-workers.ts)');
  }
  console.log('\n=== Done ===');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
