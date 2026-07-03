/**
 * Test routing config: given a call's market/state, who would get the offer and who would be rejected?
 * Uses the same logic as the assignment callback (market/state match).
 *
 * Run with last call's task attributes:
 *   npx tsx server/scripts/test-routing-config.ts
 *
 * Or with explicit market/state:
 *   npx tsx server/scripts/test-routing-config.ts "Globe Market" CO
 *   npx tsx server/scripts/test-routing-config.ts Veteran UT
 */
import twilio from 'twilio';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from '../hardcoded-config.js';
import { isTaskRouterConfigured, listRecentTasks, listWorkers } from '../taskrouter-service.js';

const TO_609 = '+16096048379';

function parseAttrs(attrs: string): Record<string, unknown> {
  try {
    return typeof attrs === 'string' ? JSON.parse(attrs) : (attrs as Record<string, unknown>) || {};
  } catch {
    return {};
  }
}

// Same logic as assignment callback (routes.ts)
function wouldAccept(
  taskMarket: string,
  taskState: string,
  workerAttrs: Record<string, unknown>
): { accept: boolean; reason: string } {
  const taskMarketEffective = taskMarket && taskMarket !== 'Unknown' ? taskMarket.trim() : '';
  const taskStateEffective =
    taskState && taskState !== 'XX' && String(taskState).trim().length === 2
      ? String(taskState).trim().toUpperCase()
      : '';

  const workerMarkets: string[] = Array.isArray(workerAttrs.markets)
    ? (workerAttrs.markets as string[]).filter((m) => typeof m === 'string').map((m) => String(m).trim())
    : [];
  const workerStates: string[] = Array.isArray(workerAttrs.licensed_states)
    ? (workerAttrs.licensed_states as string[]).filter((s) => typeof s === 'string').map((s) => String(s).trim())
    : [];
  const workerStatesUpper = workerStates.map((s) => (s.length === 2 ? s.toUpperCase() : s));
  const taskStateEffectiveUpper = taskStateEffective.length === 2 ? taskStateEffective.toUpperCase() : taskStateEffective;

  const marketMatches = (wm: string, task: string) =>
    wm === task || wm.includes(task) || task.includes(wm) || wm.toLowerCase() === task.toLowerCase();
  const marketMismatch =
    taskMarketEffective &&
    workerMarkets.length > 0 &&
    !workerMarkets.some((wm) => marketMatches(wm, taskMarketEffective));
  const stateMismatch =
    taskStateEffective && workerStates.length > 0 && !workerStatesUpper.includes(taskStateEffectiveUpper);

  if (marketMismatch && stateMismatch) return { accept: false, reason: `market mismatch (task=${taskMarketEffective}, worker=[${workerMarkets.join(',')}]) and state mismatch (task=${taskStateEffective}, worker=[${workerStates.join(',')}])` };
  if (marketMismatch) return { accept: false, reason: `market mismatch: task="${taskMarketEffective}", worker=[${workerMarkets.join(', ')}]` };
  if (stateMismatch) return { accept: false, reason: `state mismatch: task="${taskStateEffective}", worker=[${workerStates.join(', ')}]` };
  return { accept: true, reason: 'match' };
}

async function main() {
  let taskMarket = '';
  let taskState = '';

  if (process.argv[2] != null && process.argv[3] != null) {
    taskMarket = String(process.argv[2]).trim();
    taskState = String(process.argv[3]).trim().toUpperCase();
    console.log('\n=== ROUTING TEST (CLI) ===\n');
    console.log('Task (call): market =', taskMarket, '| state =', taskState);
  } else {
    console.log('\n=== ROUTING TEST (last 609 call) ===\n');
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      console.error('Missing Twilio credentials');
      process.exit(1);
    }
    if (!isTaskRouterConfigured()) {
      console.error('TaskRouter not configured');
      process.exit(1);
    }
    const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    const calls = await client.calls.list({ to: TO_609, limit: 5 });
    if (calls.length === 0) {
      console.log('No calls to 609. Run with explicit market/state:');
      console.log('  npx tsx server/scripts/test-routing-config.ts "Globe Market" CO');
      process.exit(0);
    }
    const lastCall = calls[0];
    const tasks = await listRecentTasks({ limit: 30 });
    const taskForCall = tasks.find((t) => {
      const attrs = parseAttrs(t.attributes);
      return (attrs.call_sid as string) === lastCall.sid;
    });
    if (!taskForCall) {
      console.log('No task found for last call. Use CLI: npx tsx server/scripts/test-routing-config.ts "Globe Market" CO');
      process.exit(0);
    }
    const attrs = parseAttrs(taskForCall.attributes);
    taskMarket = String(attrs.market ?? (attrs as any).taalk_market ?? '').trim();
    taskState = (String(attrs.state ?? '').trim().length === 2 ? String(attrs.state).trim().toUpperCase() : String(attrs.state ?? '').trim()) as string;
    console.log('Last call:', lastCall.sid, 'From', lastCall.from);
    console.log('Task:', taskForCall.sid, '| market =', taskMarket || '(none)', '| state =', taskState || '(none)');
  }

  if (!isTaskRouterConfigured()) {
    console.error('TaskRouter not configured');
    process.exit(1);
  }

  const workers = await listWorkers({ limit: 200 });
  const availableWorkers = await listWorkers({ activityName: 'AvailableInbound', limit: 50 });
  console.log('\n--- Workers (' + workers.length + ') vs task market=' + (taskMarket || '(any)') + ' state=' + (taskState || '(any)') + ' ---');
  console.log('--- Available for inbound (activity=AvailableInbound): ' + availableWorkers.length + ' ---\n');

  const effectiveMarket = taskMarket && taskMarket !== 'Unknown' ? taskMarket : '';
  const effectiveState = taskState && taskState !== 'XX' && taskState.length === 2 ? taskState : '';
  if (!effectiveMarket && !effectiveState) {
    console.log('(Task has no specific market/state → any worker with contact_uri can receive the call.)');
  }

  let eligible = 0;
  for (const w of workers) {
    const attrs = parseAttrs(w.attributes) as Record<string, unknown>;
    const email = (attrs.agent_email ?? attrs.email ?? w.friendlyName) as string;
    const { accept, reason } = wouldAccept(taskMarket, taskState, attrs);
    if (accept) eligible++;
    const status = accept ? 'ELIGIBLE' : 'REJECT';
    const activity = w.activityName || '';
    console.log(`${status.padEnd(8)} ${(email || w.friendlyName).padEnd(40)} activity=${activity.padEnd(18)} ${accept ? '' : reason}`);
  }

  console.log('\n--- Summary ---');
  console.log('Eligible (would pass assignment callback):', eligible, '| Rejected:', workers.length - eligible);
  const eligibleAvailable = availableWorkers.filter((w) => {
    const attrs = parseAttrs(w.attributes) as Record<string, unknown>;
    return wouldAccept(taskMarket, taskState, attrs).accept;
  });
  console.log('Eligible AND AvailableInbound (would actually get the offer):', eligibleAvailable.length);
  if (eligibleAvailable.length > 0) {
    console.log('  ', eligibleAvailable.map((w) => (parseAttrs(w.attributes) as any).agent_email || w.friendlyName).join(', '));
  }
  if (eligible === 0 && workers.length > 0) {
    console.log('\nNo one would get this call. Fix: add task market/state to workers (customers.market, customers.states) or use Unknown/XX for task to allow any.');
  }
  if (eligible > 0 && eligibleAvailable.length === 0) {
    console.log('\nSomeone is eligible but no one is AvailableInbound. Workers must be voice-online (Call Connector Pro) to receive the offer.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
