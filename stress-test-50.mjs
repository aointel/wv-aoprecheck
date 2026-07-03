const BASE = (process.env.BASE || process.env.STRESS_BASE || 'http://localhost:5000').replace(
  /\/$/,
  '',
);
const CONCURRENT_AGENTS = 50;
const DURATION_MS = 30000;
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
    if (!r.ok && r.status !== 401 && r.status !== 404) results.error++;
    else if (ms > 2000) results.slow++;
    else results.ok++;
    return ms;
  } catch (e) {
    const ms = Date.now() - start;
    if (e.name === 'TimeoutError' || e.name === 'AbortError') results.timeouts++;
    else results.error++;
    return ms;
  }
}

async function agentLoad(i) {
  const email = `testagent${i}@aoglobelife.com`;
  const end = Date.now() + DURATION_MS;
  while (Date.now() < end) {
    await Promise.all([req('/api/auth/session'), req('/api/live-call-board/stats'), req('/health')]);
    if (Math.random() < 0.3) await req('/api/vdp/routing', 'POST', { email });
    await new Promise(r => setTimeout(r, 2000 + Math.random() * 1000));
  }
}

console.log(`🔥 Stress test: ${CONCURRENT_AGENTS} concurrent agents for ${DURATION_MS / 1000}s`);
console.log(`   BASE=${BASE}`);
const start = Date.now();
await Promise.all(Array.from({ length: CONCURRENT_AGENTS }, (_, i) => agentLoad(i)));
const elapsed = ((Date.now() - start) / 1000).toFixed(1);
const avg = latencies.length ? Math.round(latencies.reduce((a, b) => a + b) / latencies.length) : 0;
const sorted = latencies.sort((a, b) => a - b);
const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
const p99 = sorted[Math.floor(sorted.length * 0.99)] || 0;
const total = results.ok + results.slow + results.error + results.timeouts;
console.log(`✅ ${elapsed}s | ${total} reqs | OK:${results.ok}(${Math.round(results.ok/total*100)}%) Slow:${results.slow} Err:${results.error} Timeout:${results.timeouts}`);
console.log(`   avg:${avg}ms  p95:${p95}ms  p99:${p99}ms`);
if (results.timeouts > 0 || results.error > 5) console.log('🚨 STABILITY ISSUES');
else if (results.slow > total * 0.1) console.log('⚠️ Some slowness');
else console.log('🟢 Stable');
