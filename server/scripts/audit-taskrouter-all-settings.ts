/**
 * Full TaskRouter audit — find ALL possible reasons tasks get 0 reservations.
 * Run: npx tsx server/scripts/audit-taskrouter-all-settings.ts
 */
import twilio from 'twilio';
import {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_TASKROUTER_WORKSPACE_SID,
  TWILIO_TASKROUTER_WORKFLOW_INBOUND_SID,
} from '../hardcoded-config.js';
import { getWorkerVoiceCapacity, listWorkers } from '../taskrouter-service.js';

async function main() {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_TASKROUTER_WORKSPACE_SID) {
    console.error('Missing Twilio config');
    process.exit(1);
  }
  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  const ws = client.taskrouter.v1.workspaces(TWILIO_TASKROUTER_WORKSPACE_SID);

  console.log('========== TASKROUTER FULL AUDIT ==========\n');

  // 1) Task channels — voice must exist for voice tasks
  const taskChannels = await ws.taskChannels.list();
  const voiceTaskChannel = (taskChannels as any[]).find(
    (tc) => (tc.uniqueName || tc.unique_name || '').toLowerCase() === 'voice'
  );
  console.log('1) TASK CHANNELS');
  if (taskChannels.length === 0) {
    console.log('   ❌ NONE — voice tasks cannot be assigned. Run provision-taskrouter.ts');
  } else {
    taskChannels.forEach((tc: any) => console.log('   ', tc.uniqueName || tc.unique_name, '| sid:', tc.sid));
    if (!voiceTaskChannel) console.log('   ❌ No "voice" channel — Enqueue creates voice tasks; workers need voice channel.');
    else console.log('   ✅ voice channel exists:', voiceTaskChannel.sid);
  }
  console.log('');

  // 2) Workflow — SID we use for Enqueue
  const workflowSid = TWILIO_TASKROUTER_WORKFLOW_INBOUND_SID || process.env.TWILIO_TASKROUTER_WORKFLOW_INBOUND_SID;
  let configRaw: string | object = {};
  let config: Record<string, any> = {};
  let assignmentUrl = '';
  let filters: any[] = [];
  let defaultQueue = '';

  if (!workflowSid) {
    console.log('2) WORKFLOW');
    console.log('   ❌ TWILIO_TASKROUTER_WORKFLOW_INBOUND_SID not set.');
  } else {
    const wf = await ws.workflows(workflowSid).fetch();
    const wfAny = wf as any;
    configRaw = wfAny.configuration ?? wfAny.config ?? {};
    config = typeof configRaw === 'string' ? JSON.parse(configRaw) : configRaw || {};
    assignmentUrl = wfAny.assignmentCallbackUrl ?? wfAny.assignment_callback_url ?? '';

    console.log('2) WORKFLOW (Enqueue uses this)');
    console.log('   SID:', workflowSid);
    console.log('   Assignment callback URL:', assignmentUrl || '(NOT SET — Twilio will never POST reservations!)');
    if (!assignmentUrl) console.log('   ❌ FIX: Run provision-taskrouter.ts with BASE_URL=https://your-server.up.railway.app');
    console.log('   taskReservationTimeout:', wfAny.taskReservationTimeout ?? wfAny.task_reservation_timeout ?? '?');

    const tr = config.task_routing || config.taskRouting || {};
    filters = tr.filters || [];
    defaultQueue = tr.default_filter?.queue || tr.defaultFilter?.queue || '';

    if (filters.length === 0) {
      console.log('   ❌ No filters — task may not route to any queue.');
    } else {
      for (let i = 0; i < filters.length; i++) {
        const f = filters[i];
        const targets = f.targets || [];
        console.log('   Filter', i + 1, ':', f.filter_friendly_name ?? f.expression ?? '');
        console.log('     filter expression:', f.expression ?? '(none)');
        for (let j = 0; j < targets.length; j++) {
          const t = targets[j];
          console.log('     Target', j + 1, '-> queue:', t.queue, '| priority:', t.priority, '| timeout:', t.timeout);
          console.log('     TARGET EXPRESSION (must match for reservation):', t.expression ?? '(NONE — all workers match)');
          if (!t.expression && targets.length === 1) console.log('     ⚠️ Empty target expression can still filter by queue targetWorkers.');
        }
      }
    }
    console.log('   default_filter queue:', defaultQueue || '(none)');
  }
  console.log('');

  // 3) Task queues — the queue the workflow sends to
  const taskQueues = await ws.taskQueues.list({ limit: 20 });
  console.log('3) TASK QUEUES');
  let queueSids: string[] = [];
  if (typeof configRaw === 'string') try { const c = JSON.parse(configRaw); queueSids = [c?.task_routing?.filters?.[0]?.targets?.[0]?.queue, c?.task_routing?.default_filter?.queue].filter(Boolean); } catch (_) {}
  else if (config?.task_routing?.filters?.[0]?.targets?.[0]?.queue) queueSids = [config.task_routing.filters[0].targets[0].queue, config.task_routing.default_filter?.queue].filter(Boolean);

  for (const tq of taskQueues as any[]) {
    const targetWorkers = tq.targetWorkers ?? tq.target_workers ?? '';
    const inWorkflow = queueSids.includes(tq.sid) || tq.sid === defaultQueue;
    console.log('   ', tq.sid, '|', tq.friendlyName ?? tq.friendly_name, '| targetWorkers:', targetWorkers.slice(0, 80));
    if (targetWorkers && targetWorkers !== '1==1' && targetWorkers.length < 200) {
      console.log('      ⚠️ Restrictive targetWorkers — workers must match this to be in queue.');
    }
    if (inWorkflow) console.log('      ^ used by workflow');
  }
  console.log('');

  // 4) Activities — AvailableInbound must exist and be available=true
  const activities = await ws.activities.list();
  const availInbound = (activities as any[]).find((a) => (a.friendlyName || a.friendly_name || '').includes('AvailableInbound'));
  console.log('4) ACTIVITIES');
  console.log('   AvailableInbound:', availInbound ? `${availInbound.sid} (available=${availInbound.available})` : '❌ NOT FOUND');
  if (availInbound && !availInbound.available) console.log('   ❌ AvailableInbound.available is false — workers in this activity may not receive tasks!');
  console.log('');

  // 5) Workers — who is online, voice capacity, and would they match Globe Market / RI?
  // Use availableOnly so we don't miss online workers when workspace has 300+ workers (list limit).
  const workersAll = await listWorkers({ limit: 500 });
  const online = await listWorkers({ availableOnly: true, limit: 100 });
  const onlineInbound = online.filter((w) => w.activityName === 'AvailableInbound');
  console.log('5) WORKERS (sample: who would match task market=Globe Market, state=RI?)');
  console.log('   Total workers (first 500):', workersAll.length, '| Available (available=true):', online.length, '| In AvailableInbound:', onlineInbound.length);

  for (const w of onlineInbound.slice(0, 15)) {
    let attrs: Record<string, unknown> = {};
    try {
      attrs = typeof w.attributes === 'string' ? JSON.parse(w.attributes) : w.attributes || {};
    } catch (_) {}
    const markets = (attrs.markets as string[]) || [];
    const states = (attrs.licensed_states as string[]) || [];
    const hasMarket = markets.includes('Globe Market');
    const hasState = states.includes('RI');
    const cap = await getWorkerVoiceCapacity(w.workerSid);
    const match = hasMarket && hasState && cap >= 1 ? '✅ WOULD MATCH' : (cap < 1 ? '❌ voice cap 0' : (!hasMarket ? '❌ no Globe Market' : '❌ no RI'));
    console.log('   ', w.friendlyName, '|', match, '| markets:', markets.slice(0, 2).join(','), '| RI:', hasState, '| voiceCap:', cap);
  }
  if (onlineInbound.length > 15) console.log('   ... and', onlineInbound.length - 15, 'more');
  console.log('');

  // 6) Summary of likely issues
  console.log('========== LIKELY ISSUES (fix these first) ==========');
  const issues: string[] = [];
  if (!voiceTaskChannel) issues.push('No voice task channel');
  if (!assignmentUrl) issues.push('Workflow assignment callback URL not set');
  if (!availInbound) issues.push('AvailableInbound activity missing');
  if (availInbound && !availInbound.available) issues.push('AvailableInbound.available is false');
  if (onlineInbound.length === 0) issues.push('No workers in AvailableInbound');
  const onlineWithCap = await Promise.all(onlineInbound.map(async (w) => ({ w, cap: await getWorkerVoiceCapacity(w.workerSid) })));
  const withVoice = onlineWithCap.filter((x) => x.cap >= 1);
  if (onlineInbound.length > 0 && withVoice.length === 0) issues.push('All online workers have voice capacity 0');
  if (filters.length > 0) {
    const firstExpr = filters[0]?.targets?.[0]?.expression ?? '';
    if (!firstExpr) issues.push('Workflow target expression is empty');
    else if (!firstExpr.includes('worker.markets') && !firstExpr.includes('worker.licensed_states')) issues.push('Target expression may not use worker.markets / worker.licensed_states — check syntax');
  }

  if (issues.length === 0) {
    console.log('   No obvious config bugs. If still 0 reservations: check (1) assignment URL is reachable by Twilio, (2) task attributes exactly market/state strings, (3) worker attributes exactly markets array and licensed_states array.');
  } else {
    issues.forEach((i) => console.log('   ❌', i));
  }
  console.log('\n=== Done ===');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
