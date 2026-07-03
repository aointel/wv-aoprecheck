/**
 * Why does a task get 0 reservations? Check workspace task channels, workflow config, worker channels.
 * Run: npx tsx server/scripts/diagnose-taskrouter-why-no-reservations.ts
 */
import twilio from 'twilio';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_TASKROUTER_WORKSPACE_SID, TWILIO_TASKROUTER_WORKFLOW_INBOUND_SID } from '../hardcoded-config.js';

async function main() {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_TASKROUTER_WORKSPACE_SID) {
    console.error('Missing Twilio config');
    process.exit(1);
  }
  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  const ws = client.taskrouter.v1.workspaces(TWILIO_TASKROUTER_WORKSPACE_SID);

  console.log('=== 1) Workspace task channels (task types) ===');
  const taskChannels = await ws.taskChannels.list();
  if (taskChannels.length === 0) {
    console.log('  NONE. Workers cannot receive tasks by channel — create a "voice" task channel and set worker channel capacity.');
  } else {
    for (const tc of taskChannels as any[]) {
      console.log('  ', tc.uniqueName || tc.sid, '| sid:', tc.sid);
    }
  }

  console.log('\n=== 2) Workflow config (actual in Twilio) ===');
  const workflowSid = TWILIO_TASKROUTER_WORKFLOW_INBOUND_SID || process.env.TWILIO_TASKROUTER_WORKFLOW_INBOUND_SID;
  if (workflowSid) {
    const wf = await ws.workflows(workflowSid).fetch();
    const config = (wf as any).configuration || (wf as any).taskRouting || '';
    const parsed = typeof config === 'string' ? (() => { try { return JSON.parse(config); } catch { return config; } })() : config;
    console.log(JSON.stringify(parsed, null, 2).slice(0, 1500));
  } else {
    console.log('  No workflow SID');
  }

  console.log('\n=== 3) Available workers (only these can get reservations) ===');
  const workersAll = await ws.workers.list();
  const available = (workersAll as any[]).filter((w) => w.available === true);
  console.log('  Total workers:', workersAll.length, '| Available (available=true):', available.length);
  if (available.length === 0) {
    console.log('  >>> NO WORKERS AVAILABLE. Set workers to AvailableInbound (e.g. have cnsysop go Online in the app and sync).');
  }
  for (const w of available.slice(0, 10) as any[]) {
    console.log('  Worker:', w.friendlyName, '| activity:', w.activityName, '| available:', w.available);
    const channels = await ws.workers(w.sid).workerChannels.list();
    if (channels.length === 0) {
      console.log('    No worker channels — worker will NOT get reservations. Add task channel to workspace and set worker channel capacity.');
    }
    for (const ch of channels as any[]) {
      const name = ch.taskChannelUniqueName || ch.task_channel_unique_name || ch.sid;
      const cap = ch.configuredCapacity ?? ch.configured_capacity ?? '?';
      const avail = ch.availableCapacity ?? ch.available_capacity ?? '?';
      console.log('    channel:', name, '| configuredCapacity:', cap, '| availableCapacity:', avail);
    }
  }
  if (available.length > 10) console.log('  ... and', available.length - 10, 'more available workers');

  const cnsysop = (workersAll as any[]).find((w) => (w.friendlyName || '').includes('cnsysop'));
  if (cnsysop) {
    console.log('\n=== cnsysop specifically ===');
    console.log('  activity:', cnsysop.activityName, '| available:', cnsysop.available);
    if (!cnsysop.available) console.log('  >>> cnsysop is NOT available — they must go Online (WebRTC) so we set them to AvailableInbound.');
  }

  console.log('\n=== Summary ===');
  if (taskChannels.length === 0) {
    console.log('FIX: Workspace has no task channels. Run provision to create a "voice" task channel, then sync workers so they have voice channel capacity.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
