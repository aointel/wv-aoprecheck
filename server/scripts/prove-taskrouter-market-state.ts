/**
 * Prove TaskRouter assigns by market + state only.
 * 1) Globe Market + WA task → only workers with Globe Market AND WA get reservations.
 * 2) Veteran + TX task → only workers with Veteran AND TX get reservations (cnsysop must NOT get it).
 *
 * Run: npx tsx server/scripts/prove-taskrouter-market-state.ts
 */
import twilio from 'twilio';
import {
  isTaskRouterConfigured,
  buildTaskAttributesFor609Inbound,
  createTask,
} from '../taskrouter-service.js';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_TASKROUTER_WORKSPACE_SID } from '../hardcoded-config.js';

const WORKSPACE_SID = TWILIO_TASKROUTER_WORKSPACE_SID!;

async function runTest(
  client: ReturnType<typeof twilio>,
  market: string,
  state: string,
  label: string
): Promise<{ taskSid: string; reservations: Array<{ workerSid: string; email: string; markets: string[]; states: string[] }> }> {
  const workspace = client.taskrouter.v1.workspaces(WORKSPACE_SID);
  const attrs = buildTaskAttributesFor609Inbound({
    call_sid: 'CA-prove-' + label.replace(/\s/g, '-') + '-' + Date.now(),
    phone_number: '+15550000000',
    market,
    state,
    lead_name: 'Prove ' + label,
  });
  const { taskSid } = await createTask(attrs);
  console.log('  Task created:', taskSid, '| market=', market, 'state=', state);
  await new Promise((r) => setTimeout(r, 7000));
  const list = await workspace.tasks(taskSid).reservations.list();
  const out: Array<{ workerSid: string; email: string; markets: string[]; states: string[] }> = [];
  for (const r of list as any[]) {
    const workerSid = r.workerSid ?? r.worker_sid;
    let email = '';
    let markets: string[] = [];
    let states: string[] = [];
    try {
      const w = await workspace.workers(workerSid).fetch();
      email = (w as any).friendlyName ?? '';
      const a = typeof (w as any).attributes === 'string' ? JSON.parse((w as any).attributes) : (w as any).attributes || {};
      markets = (a.markets as string[]) || [];
      states = (a.licensed_states as string[]) || [];
    } catch (_) {}
    out.push({ workerSid, email, markets, states });
  }
  return { taskSid, reservations: out };
}

function checkReservations(
  market: string,
  state: string,
  reservations: Array<{ email: string; markets: string[]; states: string[] }>
): { ok: boolean; wrong: string[] } {
  const wrong: string[] = [];
  for (const r of reservations) {
    const hasMarket = (r.markets as string[]).includes(market);
    const hasState = state === 'XX' || (r.states as string[]).includes(state);
    if (!hasMarket || !hasState) {
      wrong.push(r.email + ' (markets=' + JSON.stringify(r.markets) + ', states count=' + (r.states?.length ?? 0) + ')');
    }
  }
  return { ok: wrong.length === 0, wrong };
}

async function main() {
  if (!isTaskRouterConfigured() || !TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !WORKSPACE_SID) {
    console.error('TaskRouter not configured or missing credentials.');
    process.exit(1);
  }

  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

  console.log('\n=== PROOF: TaskRouter assigns by market + state ===\n');
  console.log('Workflow target expression: (task.market IN worker.markets) AND (task.state == "XX" OR task.state IN worker.licensed_states)\n');

  // --- Test 1: Globe Market + WA ---
  console.log('--- Test 1: Task market=Globe Market, state=WA ---');
  const globe = await runTest(client, 'Globe Market', 'WA', 'Globe WA');
  console.log('  Reservations:', globe.reservations.length);
  for (const r of globe.reservations) {
    const hasGlobe = r.markets.includes('Globe Market');
    const hasWA = r.states.includes('WA');
    console.log('    ', r.email, '| Globe Market:', hasGlobe, '| WA:', hasWA);
  }
  const check1 = checkReservations('Globe Market', 'WA', globe.reservations);
  if (!check1.ok) {
    console.log('  FAIL: These workers should NOT have received Globe Market + WA:', check1.wrong);
    process.exit(1);
  }
  console.log('  PASS: Only Globe Market + WA workers received reservations.\n');

  // --- Test 2: Veteran + TX (cnsysop has Globe only → must NOT get this) ---
  console.log('--- Test 2: Task market=Veteran, state=TX ---');
  const veteran = await runTest(client, 'Veteran', 'TX', 'Veteran TX');
  console.log('  Reservations:', veteran.reservations.length);
  const cnsysopGotVeteran = veteran.reservations.some((r) => r.email.toLowerCase().includes('cnsysop'));
  if (cnsysopGotVeteran) {
    console.log('  FAIL: cnsysop (Globe Market only) received a Veteran + TX task. Market/state filter is broken.');
    process.exit(1);
  }
  for (const r of veteran.reservations) {
    const hasVeteran = r.markets.includes('Veteran');
    const hasTX = r.states.includes('TX');
    console.log('    ', r.email, '| Veteran:', hasVeteran, '| TX:', hasTX);
  }
  const check2 = checkReservations('Veteran', 'TX', veteran.reservations);
  if (!check2.ok) {
    console.log('  FAIL: Some workers who received reservations do not have Veteran + TX:', check2.wrong);
    process.exit(1);
  }
  console.log('  PASS: Only Veteran + TX workers received reservations. cnsysop did NOT get this task.\n');

  console.log('=== PROOF COMPLETE ===');
  console.log('TaskRouter correctly assigns by market and state. Globe Market + WA → only Globe+WA workers. Veteran + TX → only Veteran+TX workers.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
