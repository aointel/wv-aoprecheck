/**
 * Provision Twilio TaskRouter for AOI inbound voice routing.
 * Creates: Workspace, Activities, TaskQueue, Workflow.
 * Prints SIDs to add to hardcoded-config or env:
 *   TWILIO_TASKROUTER_WORKSPACE_SID
 *   TWILIO_TASKROUTER_WORKFLOW_INBOUND_SID
 *
 * Usage: BASE_URL=https://your-app.up.railway.app npx tsx server/scripts/provision-taskrouter.ts
 */

import twilio from 'twilio';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, PRODUCTION_URL } from '../hardcoded-config.js';

const BASE_URL = process.env.BASE_URL || PRODUCTION_URL;
const WORKSPACE_FRIENDLY_NAME = 'AOI Inbound Transfers';

const ACTIVITIES: { friendlyName: string; available: boolean }[] = [
  { friendlyName: 'Offline', available: false },
  { friendlyName: 'AvailableInbound', available: true },
  { friendlyName: 'AvailableOutboundOnly', available: true },
  { friendlyName: 'Wrap', available: false },
  { friendlyName: 'BusyOnCall', available: false },
  { friendlyName: 'SoftUnavailable', available: false },
];

async function main() {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error('Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.');
    process.exit(1);
  }

  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  const assignmentCallbackUrl = `${BASE_URL}/api/twilio/taskrouter/assignment`;

  console.log('TaskRouter provisioning for AOI inbound');
  console.log('Assignment callback URL:', assignmentCallbackUrl);
  console.log('');

  // 1) Create or use existing Workspace
  let workspaceSid: string;
  const existing = await client.taskrouter.v1.workspaces.list({ friendlyName: WORKSPACE_FRIENDLY_NAME, limit: 1 });
  if (existing.length > 0) {
    workspaceSid = existing[0].sid;
    console.log('Using existing Workspace:', workspaceSid);
  } else {
    const workspace = await client.taskrouter.v1.workspaces.create({
      friendlyName: WORKSPACE_FRIENDLY_NAME,
      template: 'NONE',
      multiTaskEnabled: true,
    });
    workspaceSid = workspace.sid;
    console.log('Created Workspace:', workspaceSid);
  }

  const workspace = client.taskrouter.v1.workspaces(workspaceSid);

  // 2) Create Activities (skip if already exist)
  const activitySids: Record<string, string> = {};
  for (const { friendlyName, available } of ACTIVITIES) {
    const list = await workspace.activities.list({ friendlyName, limit: 1 });
    if (list.length > 0) {
      activitySids[friendlyName] = list[0].sid;
      console.log('Activity exists:', friendlyName, list[0].sid);
    } else {
      const act = await workspace.activities.create({ friendlyName, available });
      activitySids[friendlyName] = act.sid;
      console.log('Created Activity:', friendlyName, act.sid);
    }
  }

  const defaultActivitySid = activitySids['Offline'];
  const timeoutActivitySid = activitySids['Offline'];
  await workspace.update({ defaultActivitySid, timeoutActivitySid });
  console.log('Workspace default/timeout activity set to Offline');

  // 2b) Ensure Voice task channel exists (Enqueue creates voice tasks; workers need voice capacity)
  const taskChannels = await workspace.taskChannels.list();
  const voiceChannel = (taskChannels as any[]).find(
    (tc) => (tc.uniqueName || tc.unique_name || '').toLowerCase() === 'voice'
  );
  if (!voiceChannel) {
    await workspace.taskChannels.create({ uniqueName: 'voice', friendlyName: 'Voice' });
    console.log('Created Task Channel: voice');
  } else {
    console.log('Task Channel exists: voice', voiceChannel.sid);
  }

  // 3) Create TaskQueue
  const TASK_QUEUE_NAME = 'AOI Inbound Voice';
  let taskQueueSid: string;
  // Target timeout = how long this target is tried before moving on. With pending reservations we do NOT accept in the callback,
  // so Twilio moves to next target after this and RELEASES the current reservation = ring STOPS. So this MUST be the full
  // ring duration (90s), not 5s, or the interface literally stops the ring after 5 seconds.
  const RESERVATION_TIMEOUT_SEC = 60; // Each agent rings for 60s total (cascading adds new agents every 6s via target timeout)
  const MAX_RESERVED_WORKERS = 50; // Cascading: add 1 agent every 6s, all ring until someone answers

  // TaskQueue targetWorkers can only reference WORKER attributes (no task.*). So use 1==1 so all workers
  // are eligible for this queue. Market/state filtering is done by the WORKFLOW target expression (task + worker).
  const TASK_QUEUE_TARGET_WORKERS = '1==1';
  const queues = await workspace.taskQueues.list({ friendlyName: TASK_QUEUE_NAME, limit: 1 });
  if (queues.length > 0) {
    taskQueueSid = queues[0].sid;
    await workspace.taskQueues(taskQueueSid).update({
      targetWorkers: TASK_QUEUE_TARGET_WORKERS,
      maxReservedWorkers: MAX_RESERVED_WORKERS,
    });
    console.log('Using existing TaskQueue:', taskQueueSid, 'targetWorkers=', TASK_QUEUE_TARGET_WORKERS, '(filter in workflow), maxReservedWorkers=', MAX_RESERVED_WORKERS);
  } else {
    const tq = await workspace.taskQueues.create({
      friendlyName: TASK_QUEUE_NAME,
      targetWorkers: TASK_QUEUE_TARGET_WORKERS,
      maxReservedWorkers: MAX_RESERVED_WORKERS,
      taskOrder: 'FIFO',
    });
    taskQueueSid = tq.sid;
    console.log('Created TaskQueue:', taskQueueSid, 'targetWorkers=', TASK_QUEUE_TARGET_WORKERS, ', maxReservedWorkers=', MAX_RESERVED_WORKERS);
  }

  // Workflow target expression: allow Unknown/XX (no lead) to match ANY worker; otherwise match market + state.
  // Without "task.market == \"Unknown\"" tasks with unknown caller never match → calls sit in queue forever.
  const TARGET_EXPRESSION =
    "(task.market == \"Unknown\" OR task.market IN worker.markets) AND (task.state == \"XX\" OR task.state IN worker.licensed_states)";

  const WAVE_COUNT = 50; // 50 waves × 6s = 5 min of cascading through agents one at a time
  const workflowConfig = {
    task_routing: {
      filters: [
        {
          filter_friendly_name: 'Inbound voice',
          expression: '1==1',
          targets: Array.from({ length: WAVE_COUNT }, () => ({
            queue: taskQueueSid,
            priority: 1,
            timeout: RESERVATION_TIMEOUT_SEC, // Must match ring duration: with pending=true Twilio releases reservation when target times out, so 5s = ring stops at 5s
            expression: TARGET_EXPRESSION,
          })),
        },
      ],
      default_filter: { queue: taskQueueSid },
    },
  };

  const WORKFLOW_NAME = 'AOI Inbound Voice';
  let workflowSid: string;
  const workflows = await workspace.workflows.list({ friendlyName: WORKFLOW_NAME, limit: 1 });
  if (workflows.length > 0) {
    workflowSid = workflows[0].sid;
    // Fetch current config, patch all target timeouts to 90, then update (ensures Twilio gets correct timeouts)
    const currentWf = await workspace.workflows(workflowSid).fetch();
    const currentConfigRaw = (currentWf as any).configuration;
    const patchedConfig = typeof currentConfigRaw === 'string' ? JSON.parse(currentConfigRaw) : { ...currentConfigRaw };
    if (patchedConfig?.task_routing?.filters) {
      for (const filter of patchedConfig.task_routing.filters) {
        if (Array.isArray(filter.targets)) {
          for (const target of filter.targets) {
            target.timeout = RESERVATION_TIMEOUT_SEC;
            target.expression = TARGET_EXPRESSION;
          }
        }
      }
    }
    await workspace.workflows(workflowSid).update({
      configuration: JSON.stringify(patchedConfig),
      assignmentCallbackUrl,
      taskReservationTimeout: RESERVATION_TIMEOUT_SEC,
    });
    console.log('Updated existing Workflow:', workflowSid, 'targetTimeout=', RESERVATION_TIMEOUT_SEC, 's (ring stays live)');
    // Verify: re-fetch and assert first target timeout is 90
    const verifyWf = await workspace.workflows(workflowSid).fetch();
    const verifyConfig = (verifyWf as any).configuration;
    const verifyParsed = typeof verifyConfig === 'string' ? JSON.parse(verifyConfig) : verifyConfig;
    const firstTargetTimeout = verifyParsed?.task_routing?.filters?.[0]?.targets?.[0]?.timeout;
    if (firstTargetTimeout !== RESERVATION_TIMEOUT_SEC) {
      console.error('Provision failed: after update, first target timeout is', firstTargetTimeout, 'expected', RESERVATION_TIMEOUT_SEC);
      throw new Error('Workflow target timeout did not persist; expected ' + RESERVATION_TIMEOUT_SEC + ', got ' + firstTargetTimeout);
    }
    console.log('Verified: first target timeout =', firstTargetTimeout, 's');
  } else {
    const wf = await workspace.workflows.create({
      friendlyName: WORKFLOW_NAME,
      configuration: JSON.stringify(workflowConfig),
      assignmentCallbackUrl,
      taskReservationTimeout: RESERVATION_TIMEOUT_SEC,
    });
    workflowSid = wf.sid;
    console.log('Created Workflow:', workflowSid, 'targetTimeout=', RESERVATION_TIMEOUT_SEC, 's (ring stays live)');
  }

  console.log('');
  console.log('--- Add these to hardcoded-config or environment ---');
  console.log('TWILIO_TASKROUTER_WORKSPACE_SID=' + workspaceSid);
  console.log('TWILIO_TASKROUTER_WORKFLOW_INBOUND_SID=' + workflowSid);
  console.log('');
  console.log('Activity SIDs (for worker sync):', JSON.stringify(activitySids, null, 2));
  console.log('TaskQueue SID:', taskQueueSid);
  console.log('');
  console.log('Done. Assignment callback:', assignmentCallbackUrl);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
