/**
 * Stress test: simulates concurrent agent load
 * - Session checks (what every page load does)
 * - LCB stats polls (every 2s per agent watching dashboard)  
 * - VDP routing (loads on Connect page)
 * - Health checks
 */

/** Target API (prod example: https://aoirail-production-baa2.up.railway.app) */
const BASE = (process.env.BASE || process.env.STRESS_BASE || 'http://localhost:5000').replace(
  /\/$/,
  '',
);
const CONCURRENT_AGENTS = Math.min(
  500,
  Math.max(1, parseInt(process.env.CONCURRENT_AGENTS || process.env.AGENTS || '25', 10)),
);
const DURATION_MS = Math.min(
  300_000,
  Math.max(5_000, parseInt(process.env.DURATION_MS || '30000', 10)),
);
const results = { ok: 0, slow: 0, error: 0, timeouts: 0 };
const latencies = [];

async function req(path, method = 'GET', body = null) {
  const start = Date.now();
  try {
    const opts = { method, headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(5000) };
    if (body) opts.body = JSON.stringify(body);
    const r = await fetch(`${BASE}${path}`, opts);
    const ms = Date.now() - start;
    latencies.push(ms);
    if (!r.ok && r.status !== 401 && r.status !== 404) {
      results.error++;
    } else if (ms > 2000) {
      results.slow++;
    } else {
      results.ok++;
    }
    return ms;
  } catch (e) {
    const ms = Date.now() - start;
    if (e.name === 'TimeoutError' || e.name === 'AbortError') results.timeouts++;
    else results.error++;
    return ms;
  }
}

async function agentLoad(agentIndex) {
  const email = `testagent${agentIndex}@aoglobelife.com`;
  const end = Date.now() + DURATION_MS;
  
  while (Date.now() < end) {
    // Simulate what a connected agent does
    await Promise.all([
      req('/api/auth/session'),
      req('/api/live-call-board/stats', 'GET'),
      req('/health'),
    ]);
    
    // VDP routing (less frequent)
    if (Math.random() < 0.3) {
      await req('/api/vdp/routing', 'POST', { email });
    }
    
    await new Promise(r => setTimeout(r, 2000 + Math.random() * 1000));
  }
}

console.log(`🔥 Stress test: ${CONCURRENT_AGENTS} concurrent agents for ${DURATION_MS / 1000}s`);
console.log(`   BASE=${BASE}`);
console.log(`   Simulating: session checks, LCB polls, VDP routing\n`);

const start = Date.now();
await Promise.all(Array.from({ length: CONCURRENT_AGENTS }, (_, i) => agentLoad(i)));
const elapsed = ((Date.now() - start) / 1000).toFixed(1);

const avg = latencies.length ? Math.round(latencies.reduce((a, b) => a + b) / latencies.length) : 0;
const p95 = latencies.length ? latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)] : 0;
const p99 = latencies.length ? latencies[Math.floor(latencies.length * 0.99)] : 0;
const total = results.ok + results.slow + results.error + results.timeouts;

console.log(`✅ Results after ${elapsed}s:`);
console.log(`   Total requests: ${total}`);
console.log(`   ✅ OK (<2s):    ${results.ok} (${Math.round(results.ok/total*100)}%)`);
console.log(`   ⚠️  Slow (>2s):  ${results.slow} (${Math.round(results.slow/total*100)}%)`);
console.log(`   ❌ Errors:      ${results.error}`);
console.log(`   ⏱️  Timeouts:    ${results.timeouts}`);
console.log(`\n   Latency avg: ${avg}ms  p95: ${p95}ms  p99: ${p99}ms`);

if (results.timeouts > 0 || results.error > 5) {
  console.log('\n🚨 STABILITY ISSUES DETECTED');
} else if (results.slow > total * 0.1) {
  console.log('\n⚠️  Some slowness but no critical failures');
} else {
  console.log('\n🟢 Server stable under load');
}
