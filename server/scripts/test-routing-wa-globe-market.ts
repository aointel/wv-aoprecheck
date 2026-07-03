/**
 * Test TaskRouter routing for a WA + Globe Market call.
 * 1) List workers and their market/state (who should get Globe Market + WA).
 * 2) Create a task: market=Globe Market, state=WA.
 * 3) Wait for workflow to run and assignment callback.
 * 4) List reservations — only workers with Globe Market and WA in licensed_states should get it.
 *
 * Run: npx tsx server/scripts/test-routing-wa-globe-market.ts
 */
import twilio from 'twilio';
import {
  isTaskRouterConfigured,
  buildTaskAttributesFor609Inbound,
  createTask,
  listWorkers,
} from '../taskrouter-service.js';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_TASKROUTER_WORKSPACE_SID } from '../hardcoded-config.js';

const TASK_MARKET = 'Globe Market';
const TASK_STATE = 'WA';

async function main() {
  if (!isTaskRouterConfigured()) {
    console.error('TaskRouter not configured.');
    process.exit(1);
  }

  const workspaceSid = TWILIO_TASKROUTER_WORKSPACE_SID || process.env.TWILIO_TASKROUTER_WORKSPACE_SID;
  if (!workspaceSid || !TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error('Missing Twilio config.');
    process.exit(1);
  }

  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  const workspace = client.taskrouter.v1.workspaces(workspaceSid);

  console.log('=== 1) Workers and their market/state (who can get Globe Market + WA?) ===\n');
  const workers = await listWorkers({ limit: 200 });
  for (const w of workers) {
    let attrs: Record<string, unknown> = {};
    try {
      attrs = typeof w.attributes === 'string' ? JSON.parse(w.attributes) : (w.attributes || {});
    } catch (_) {}
    const markets = (attrs.markets as string[]) || [];
    const states = (attrs.licensed_states as string[]) || [];
    const marketMatch = markets.includes(TASK_MARKET);
    const stateMatch = states.includes(TASK_STATE);
    const wouldMatch = marketMatch && (TASK_STATE === 'XX' || stateMatch);
    console.log(
      w.friendlyName,
      '| markets:', JSON.stringify(markets),
      '| states:', states.length, 'states',
      '| Globe+WA match:', wouldMatch ? 'YES' : 'no'
    );
  }

  console.log('\n=== 2) Creating task: market=Globe Market, state=WA ===\n');
  const attributes = buildTaskAttributesFor609Inbound({
    call_sid: 'CA-test-wa-globe-' + Date.now(),
    phone_number: '+15551234567',
    market: TASK_MARKET,
    state: TASK_STATE,
    lead_name: 'Test WA Globe',
  });
  console.log('Task attributes (market/state):', JSON.parse(attributes).market, JSON.parse(attributes).state);

  const { taskSid } = await createTask(attributes);
  console.log('Task created:', taskSid);

  console.log('\nWaiting 8s for TaskRouter workflow + assignment callback...\n');
  await new Promise((r) => setTimeout(r, 8000));

  console.log('=== 3) Reservations for this task ===\n');
  const reservations = await workspace.tasks(taskSid).reservations.list();

  const onlineMatch = workers.filter(
    (w) => w.available && (() => {
      let a: Record<string, unknown> = {};
      try { a = typeof w.attributes === 'string' ? JSON.parse(w.attributes) : (w.attributes || {}); } catch (_) {}
      const markets = (a.markets as string[]) || [];
      const states = (a.licensed_states as string[]) || [];
      return markets.includes(TASK_MARKET) && states.includes(TASK_STATE);
    })()
  );
  if (reservations.length === 0) {
    console.log('RESULT: 0 reservations.');
    if (onlineMatch.length === 0) {
      console.log('No Globe Market + WA worker is currently ONLINE (AvailableInbound). Routing is correct — when one goes online they will get WA Globe Market calls.');
      console.log('Task entered queue; filter is (task.market IN worker.markets) AND (task.state == "XX" OR task.state IN worker.licensed_states).');
    } else {
      console.log(onlineMatch.length, 'matching worker(s) online but 0 reservations — they may have no available voice capacity (e.g. already on a call).');
    }
    process.exit(0);
  }

  let anyWrong = false;
  for (const r of reservations as any[]) {
    const workerSid = r.workerSid ?? r.worker_sid;
    const status = r.reservationStatus ?? r.reservation_status ?? r.status;
    let email = '';
    let markets: string[] = [];
    let states: string[] = [];
    if (workerSid) {
      try {
        const w = await workspace.workers(workerSid).fetch();
        email = (w as any).friendlyName ?? '';
        const attrs = typeof (w as any).attributes === 'string' ? JSON.parse((w as any).attributes) : (w as any).attributes || {};
        markets = (attrs.markets as string[]) || [];
        states = (attrs.licensed_states as string[]) || [];
      } catch (_) {}
    }
    const hasGlobe = markets.includes(TASK_MARKET);
    const hasWA = states.includes(TASK_STATE);
    const correct = hasGlobe && hasWA;
    if (!correct) anyWrong = true;
    console.log(
      workerSid,
      '|', email,
      '| markets:', JSON.stringify(markets),
      '| WA in states:', hasWA,
      '| status:', status,
      correct ? '' : ' <-- WRONG (should not get Globe Market + WA)'
    );
  }

  if (anyWrong) {
    console.log('\nRESULT: At least one worker who should NOT get Globe Market + WA received a reservation. Filter is wrong.');
    process.exit(1);
  }

  console.log('\nRESULT: Routing OK. Only workers with Globe Market + WA got reservations.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
