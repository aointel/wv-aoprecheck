/**
 * AOIrail Production Stress Test
 * Simulates realistic concurrent agent load against the live server
 * 
 * Usage:
 *   node stress-test-prod.mjs --agents=50 --duration=60
 *   node stress-test-prod.mjs --agents=100 --duration=120 --url=https://aoirail-production.up.railway.app
 */

const args = Object.fromEntries(
  process.argv.slice(2).map(a => a.replace('--','').split('='))
);

const BASE_URL = args.url || 'https://aoirail-production.up.railway.app';
const NUM_AGENTS = parseInt(args.agents || '50');
const DURATION_SEC = parseInt(args.duration || '60');
const VERBOSE = args.verbose === 'true';

console.log(`\n🚀 AOIrail Stress Test`);
console.log(`   Target:   ${BASE_URL}`);
console.log(`   Agents:   ${NUM_AGENTS} concurrent`);
console.log(`   Duration: ${DURATION_SEC}s`);
console.log(`\n`);

// ── Stats tracking ────────────────────────────────────────────────────────────
const stats = {
  requests: 0,
  success: 0,
  errors: 0,
  timeouts: 0,
  latencies: [],
  byEndpoint: {},
};

function record(endpoint, ms, ok) {
  stats.requests++;
  if (ok) stats.success++;
  else stats.errors++;
  stats.latencies.push(ms);
  if (!stats.byEndpoint[endpoint]) stats.byEndpoint[endpoint] = { count: 0, errors: 0, totalMs: 0, maxMs: 0 };
  stats.byEndpoint[endpoint].count++;
  stats.byEndpoint[endpoint].totalMs += ms;
  if (ms > stats.byEndpoint[endpoint].maxMs) stats.byEndpoint[endpoint].maxMs = ms;
  if (!ok) stats.byEndpoint[endpoint].errors++;
}

async function hit(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const start = Date.now();
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    });
    const ms = Date.now() - start;
    const ok = res.status < 500;
    record(endpoint, ms, ok);
    if (VERBOSE) console.log(`  ${ok ? '✅' : '❌'} ${res.status} ${endpoint} ${ms}ms`);
    return { ok, status: res.status, ms };
  } catch (err) {
    const ms = Date.now() - start;
    if (err.name === 'TimeoutError') stats.timeouts++;
    record(endpoint, ms, false);
    if (VERBOSE) console.log(`  ❌ TIMEOUT ${endpoint} ${ms}ms`);
    return { ok: false, status: 0, ms };
  }
}

// ── Simulated agent emails ────────────────────────────────────────────────────
function agentEmail(i) {
  return `loadtest_agent_${i}@aoglobelife.com`;
}

// ── Agent behavior loop ───────────────────────────────────────────────────────
// Each agent simulates what a real agent does every few seconds
async function agentLoop(agentId, stopAt) {
  const email = agentEmail(agentId);
  let tick = 0;

  while (Date.now() < stopAt) {
    tick++;

    // Every agent polls these every ~5 seconds
    const promises = [
      hit(`/api/agent/panel-data?email=${encodeURIComponent(email)}&market=globe`),
      hit(`/api/twilio/taskrouter/pending?agentEmail=${encodeURIComponent(email)}`),
      hit(`/api/diagnostics/proxy/live-queue`),
      hit(`/health`),
    ];

    // Every 3 ticks: credit check + heartbeat
    if (tick % 3 === 0) {
      promises.push(
        hit(`/api/user/credit-status`, {
          headers: { 'x-user-email': email }
        }),
        hit(`/api/usage/heartbeat`, {
          method: 'POST',
          body: JSON.stringify({ userEmail: email, page: 'dashboard', action: 'none' }),
        }),
      );
    }

    // Every 5 ticks: simulate a call connector heartbeat
    if (tick % 5 === 0) {
      promises.push(
        hit(`/api/call-connector-pro/heartbeat`, {
          method: 'POST',
          body: JSON.stringify({ agentEmail: email }),
        }),
        hit(`/api/call-connector-pro/eligible-for-inbound`, {
          headers: { 'x-user-email': email }
        }),
      );
    }

    // Every 10 ticks: agent profile fetch
    if (tick % 10 === 0) {
      promises.push(
        hit(`/api/agent/profile-direct`, {
          headers: { 'x-user-email': email }
        }),
      );
    }

    await Promise.all(promises);

    // Wait 5s between ticks (realistic agent poll interval)
    const waitMs = 4500 + Math.random() * 1000;
    await new Promise(r => setTimeout(r, waitMs));
  }
}

// ── Progress reporter ─────────────────────────────────────────────────────────
function printProgress() {
  const lats = stats.latencies.slice().sort((a,b) => a-b);
  const p50 = lats[Math.floor(lats.length * 0.50)] || 0;
  const p95 = lats[Math.floor(lats.length * 0.95)] || 0;
  const p99 = lats[Math.floor(lats.length * 0.99)] || 0;
  const errRate = stats.requests > 0 ? ((stats.errors / stats.requests) * 100).toFixed(1) : '0.0';
  
  process.stdout.write(
    `\r  📊 Reqs: ${stats.requests} | ✅ ${stats.success} | ❌ ${stats.errors} (${errRate}%) | ⏱️ ${stats.timeouts} timeouts | p50: ${p50}ms p95: ${p95}ms p99: ${p99}ms    `
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  // Warm up with health check
  const warmup = await hit('/health');
  if (!warmup.ok) {
    console.error(`❌ Server not reachable at ${BASE_URL}`);
    process.exit(1);
  }
  console.log(`✅ Server reachable (${warmup.ms}ms)\n`);

  const stopAt = Date.now() + (DURATION_SEC * 1000);

  // Start all agent loops concurrently
  const agents = Array.from({ length: NUM_AGENTS }, (_, i) => agentLoop(i, stopAt));

  // Progress reporter every 5s
  const reporter = setInterval(printProgress, 5000);

  // Wait for all agents to finish
  await Promise.all(agents);
  clearInterval(reporter);
  printProgress();

  // ── Final report ─────────────────────────────────────────────────────────
  const lats = stats.latencies.slice().sort((a,b) => a-b);
  const avg = lats.length ? Math.round(lats.reduce((s,v) => s+v, 0) / lats.length) : 0;
  const p50 = lats[Math.floor(lats.length * 0.50)] || 0;
  const p95 = lats[Math.floor(lats.length * 0.95)] || 0;
  const p99 = lats[Math.floor(lats.length * 0.99)] || 0;
  const max = lats[lats.length - 1] || 0;

  console.log(`\n\n${'═'.repeat(60)}`);
  console.log(`  STRESS TEST RESULTS`);
  console.log(`${'═'.repeat(60)}`);
  console.log(`  Agents simulated:  ${NUM_AGENTS}`);
  console.log(`  Duration:          ${DURATION_SEC}s`);
  console.log(`  Total requests:    ${stats.requests}`);
  console.log(`  Requests/sec:      ${(stats.requests / DURATION_SEC).toFixed(1)}`);
  console.log(`  Success rate:      ${((stats.success / stats.requests) * 100).toFixed(1)}%`);
  console.log(`  Errors:            ${stats.errors}`);
  console.log(`  Timeouts (>15s):   ${stats.timeouts}`);
  console.log(`\n  Latency:`);
  console.log(`    avg: ${avg}ms`);
  console.log(`    p50: ${p50}ms`);
  console.log(`    p95: ${p95}ms`);
  console.log(`    p99: ${p99}ms`);
  console.log(`    max: ${max}ms`);
  console.log(`\n  By endpoint:`);
  
  for (const [ep, s] of Object.entries(stats.byEndpoint).sort((a,b) => b[1].totalMs - a[1].totalMs)) {
    const avgMs = Math.round(s.totalMs / s.count);
    const errPct = ((s.errors / s.count) * 100).toFixed(0);
    console.log(`    ${ep.padEnd(50)} avg:${avgMs}ms max:${s.maxMs}ms err:${errPct}% (${s.count} reqs)`);
  }
  console.log(`${'═'.repeat(60)}\n`);

  // Grading
  if (p95 < 500 && stats.errors / stats.requests < 0.01) {
    console.log(`  🟢 EXCELLENT — p95 under 500ms, <1% errors`);
  } else if (p95 < 2000 && stats.errors / stats.requests < 0.05) {
    console.log(`  🟡 ACCEPTABLE — p95 under 2s, <5% errors`);
  } else {
    console.log(`  🔴 NEEDS WORK — high latency or error rate`);
  }
  console.log();
}

main().catch(console.error);
