/**
 * After creating a task (e.g. enqueue-test-task-globe-co), run this with the task SID
 * to see exact task + worker attributes and why the workflow might not match.
 *
 * Run: npx tsx server/scripts/debug-why-no-reservation.ts WT7d2de0dc79a3b0db0c543cc89459bc71
 */
import twilio from 'twilio';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_TASKROUTER_WORKSPACE_SID } from '../hardcoded-config.js';

const taskSid = process.argv[2]?.trim();
if (!taskSid?.startsWith('WT')) {
  console.error('Usage: npx tsx server/scripts/debug-why-no-reservation.ts <TaskSid>');
  process.exit(1);
}

async function main() {
  const client = twilio(TWILIO_ACCOUNT_SID!, TWILIO_AUTH_TOKEN!);
  const ws = client.taskrouter.v1.workspaces(TWILIO_TASKROUTER_WORKSPACE_SID!);

  const task = await ws.tasks(taskSid).fetch();
  const t = task as any;
  const taskAttrs = typeof t.attributes === 'string' ? JSON.parse(t.attributes) : t.attributes || {};
  const taskChannel = t.taskChannelUniqueName ?? t.task_channel_unique_name ?? t.taskChannelSid;

  console.log('=== TASK ===');
  console.log('  sid:', taskSid);
  console.log('  task_channel:', taskChannel);
  console.log('  assignment_status:', t.assignmentStatus ?? t.assignment_status);
  console.log('  attributes.market:', taskAttrs.market, '(type:', typeof taskAttrs.market + ')');
  console.log('  attributes.state:', taskAttrs.state, '(type:', typeof taskAttrs.state + ')');
  console.log('  Full task attributes:', JSON.stringify(taskAttrs, null, 2));
  console.log('');

  const workers = await ws.workers.list({ available: 'true', limit: 10 });
  console.log('=== AVAILABLE WORKERS (first 10) ===');
  for (const w of workers as any[]) {
    const attrs = typeof w.attributes === 'string' ? JSON.parse(w.attributes) : w.attributes || {};
    const markets = attrs.markets;
    const states = attrs.licensed_states;
    const marketMatch = taskAttrs.market === 'Unknown' || (Array.isArray(markets) && markets.includes(taskAttrs.market));
    const stateMatch = taskAttrs.state === 'XX' || (Array.isArray(states) && states.includes(taskAttrs.state));
    console.log('  ', w.friendlyName);
    console.log('      activity:', w.activityName);
    console.log('      markets:', markets, '| type:', typeof markets, '| marketMatch:', marketMatch);
    console.log('      licensed_states:', Array.isArray(states) ? states.slice(0, 5) + (states.length > 5 ? '...' : '') : states, '| stateMatch:', stateMatch);
    console.log('      WOULD MATCH expression?', marketMatch && stateMatch ? 'YES' : 'NO');
  }

  const reservations = await ws.tasks(taskSid).reservations.list();
  console.log('');
  console.log('Reservations:', reservations.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
