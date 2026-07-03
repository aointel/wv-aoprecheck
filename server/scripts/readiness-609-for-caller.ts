/**
 * "Will a 609 call from this number actually ring someone?"
 * Uses same masterlead lookup and same market/state matching as TaskRouter workflow.
 * Run: npx tsx server/scripts/readiness-609-for-caller.ts +15032018470
 */
import { supabaseAdmin } from '../supabase.js';
import { isTaskRouterConfigured, listWorkers } from '../taskrouter-service.js';

const phoneArg = process.argv[2] || '';
const callerLast10 = String(phoneArg).replace(/\D/g, '').slice(-10);

function parseWorkerArrays(attrs: Record<string, unknown>, key: string): string[] {
  const v = attrs[key];
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parsed.map((x) => String(x).trim()).filter(Boolean);
    } catch (_) {}
    return v.trim() ? [v.trim()] : [];
  }
  return [];
}

/** Same market/state match as workflow target expression (Twilio: task.x IN worker.x; we sync state uppercase, market as-is). */
function workerMatchesTask(
  taskMarket: string,
  taskState: string,
  workerMarkets: string[],
  workerStates: string[]
): boolean {
  const marketOk = taskMarket === 'Unknown' || workerMarkets.some((m) => m === taskMarket || m.toLowerCase() === taskMarket.toLowerCase());
  const stateOk = taskState === 'XX' || workerStates.some((s) => s.toUpperCase() === taskState || s === taskState);
  return marketOk && stateOk;
}

async function main() {
  if (callerLast10.length < 10) {
    console.error('Usage: npx tsx server/scripts/readiness-609-for-caller.ts <phone>');
    console.error('Example: npx tsx server/scripts/readiness-609-for-caller.ts +15032018470');
    process.exit(1);
  }

  console.log('\n=== 609 readiness: will a call from this number ring anyone? ===\n');
  console.log('Caller (last 10):', callerLast10);

  if (!supabaseAdmin) {
    console.error('Supabase admin not configured');
    process.exit(1);
  }

  const { data: leadRow, error } = await supabaseAdmin
    .from('masterlead')
    .select('id, state, taalk_state, taalk_market, updated_at')
    .ilike('phone', `%${callerLast10}%`)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('masterlead query error:', error.message);
    process.exit(1);
  }

  const leadMarket = (leadRow as any)?.taalk_market ?? (leadRow as any)?.market ?? 'Unknown';
  const leadStateRaw = (leadRow as any)?.state ?? (leadRow as any)?.taalk_state ?? 'XX';
  const taskMarket = (leadMarket && String(leadMarket).trim() !== 'Unknown') ? String(leadMarket).trim() : 'Unknown';
  const taskState =
    leadStateRaw && String(leadStateRaw).trim().length === 2
      ? String(leadStateRaw).trim().toUpperCase()
      : 'XX';

  console.log('Task would get: market =', JSON.stringify(taskMarket), ', state =', JSON.stringify(taskState));
  if (!leadRow) console.log('(no masterlead row → Unknown/XX; any worker with routing_target will match market/state)');
  console.log('');

  if (!isTaskRouterConfigured()) {
    console.log('TaskRouter not configured. Configure workspace + workflow SIDs and re-run.');
    process.exit(1);
  }

  const workers = await listWorkers({ availableOnly: true, limit: 200 });

  const matching: typeof workers = [];
  for (const w of workers) {
    let attrs: Record<string, unknown> = {};
    try {
      attrs = typeof w.attributes === 'string' ? JSON.parse(w.attributes) : w.attributes || {};
    } catch (_) {}
    const workerMarkets = parseWorkerArrays(attrs, 'markets');
    const workerStates = parseWorkerArrays(attrs, 'licensed_states');
    if (workerMatchesTask(taskMarket, taskState, workerMarkets, workerStates)) matching.push(w);
  }

  console.log('Workers online & available (AvailableInbound):', workers.length);
  console.log('Workers that match this task (market + state):', matching.length);
  console.log('');

  if (matching.length > 0) {
    console.log('Ready: a 609 call from +1' + callerLast10 + ' would be offered to:');
    matching.slice(0, 15).forEach((w) => {
      let attrs: Record<string, unknown> = {};
      try {
        attrs = typeof w.attributes === 'string' ? JSON.parse(w.attributes) : w.attributes || {};
      } catch (_) {}
      const email = (attrs.agent_email ?? attrs.email ?? w.friendlyName) as string;
      console.log('  -', w.friendlyName, '|', email);
    });
    if (matching.length > 15) console.log('  ... and', matching.length - 15, 'more');
    console.log('');
    console.log('To confirm end-to-end: place a test call to 609, then run:');
    console.log('  npx tsx server/scripts/diagnose-last-inbound-609.ts');
    console.log('  npx tsx server/scripts/task-reservations.ts');
  } else {
    console.log('Not ready: no workers would get this task.');
    if (workers.length === 0) {
      console.log('  No one is online. Have agents go Online (voice) and sync.');
    } else {
      console.log('  Workers are online but none have market/state matching:', taskMarket, '/', taskState);
      console.log('  Check customers table (market, states) for those agents, or masterlead for this caller.');
    }
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
