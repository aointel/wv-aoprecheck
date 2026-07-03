/**
 * AOIrail Twilio Webhook Stress Test
 * Simulates real Twilio call flow webhooks hitting the server concurrently
 * Tests: dial-action, call-status, vdp/heartbeat, hotlead/update, outbound-dialer
 *
 * Usage:
 *   node stress-test-twilio.mjs --calls=30 --duration=60
 *   node stress-test-twilio.mjs --calls=50 --duration=120 --url=https://aoirail-production.up.railway.app
 */

import crypto from 'crypto';

const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace('--','').split('=')));
const BASE_URL = args.url || 'https://aoirail-production.up.railway.app';
const NUM_CALLS = parseInt(args.calls || '30');
const DURATION_SEC = parseInt(args.duration || '60');
const VERBOSE = args.verbose === 'true';

// Fake agent pool
const AGENTS = Array.from({ length: 20 }, (_, i) => `loadtest_agent_${i}@aoglobelife.com`);
const STATES = ['PA','VA','TN','OH','NC','FL','TX','CA','GA','IN'];
const LEAD_PHONES = Array.from({ length: 200 }, (_, i) => `+1555${String(i).padStart(7,'0')}`);

function randomItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randomSid(prefix='CA') { return prefix + crypto.randomBytes(16).toString('hex'); }
function randomPhone() { return randomItem(LEAD_PHONES); }
function randomAgent() { return randomItem(AGENTS); }
function randomState() { return randomItem(STATES); }

// ── Stats ──────────────────────────────────────────────────────────────────────
const stats = { requests: 0, success: 0, errors: 0, timeouts: 0, latencies: [], byEndpoint: {} };

function record(endpoint, ms, ok) {
  stats.requests++;
  if (ok) stats.success++; else stats.errors++;
  stats.latencies.push(ms);
  if (!stats.byEndpoint[endpoint]) stats.byEndpoint[endpoint] = { count:0, errors:0, totalMs:0, maxMs:0 };
  const e = stats.byEndpoint[endpoint];
  e.count++; e.totalMs += ms;
  if (ms > e.maxMs) e.maxMs = ms;
  if (!ok) e.errors++;
}

async function hit(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const start = Date.now();
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      ...options,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...options.headers },
    });
    const ms = Date.now() - start;
    const ok = res.status < 500;
    record(endpoint, ms, ok);
    if (VERBOSE) console.log(`  ${ok?'✅':'❌'} ${res.status} ${endpoint} ${ms}ms`);
    return { ok, status: res.status, ms };
  } catch(err) {
    const ms = Date.now() - start;
    if (err.name === 'TimeoutError') stats.timeouts++;
    record(endpoint, ms, false);
    if (VERBOSE) console.log(`  ❌ TIMEOUT ${endpoint} ${ms}ms`);
    return { ok: false, status: 0, ms };
  }
}

function urlEncoded(obj) {
  return Object.entries(obj).map(([k,v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
}

async function jsonHit(endpoint, body, method='POST') {
  return hit(endpoint, {
    method,
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

async function formHit(endpoint, body) {
  return hit(endpoint, {
    method: 'POST',
    body: urlEncoded(body),
  });
}

// ── Simulate one complete call lifecycle ──────────────────────────────────────
async function simulateCall(callId) {
  const agentEmail = randomAgent();
  const leadPhone = randomPhone();
  const state = randomState();
  const callSid = randomSid('CA');
  const childCallSid = randomSid('CA');
  const leadId = Math.floor(Math.random() * 900000) + 100000;

  // 1. Agent initiates outbound call
  await jsonHit('/api/outbound-dialer/initiate-call', {
    agentEmail,
    leadPhone,
    leadState: state,
    leadId: String(leadId),
    leadName: `Test Lead ${callId}`,
    market: 'Globe',
  });

  // Small delay — Twilio processes the call
  await new Promise(r => setTimeout(r, 200 + Math.random() * 300));

  // 2. Twilio fires dial-action when call connects
  await formHit('/api/twilio/dial-action', {
    CallSid: callSid,
    DialCallSid: childCallSid,
    DialCallStatus: 'completed',
    DialCallDuration: String(Math.floor(30 + Math.random() * 180)),
    From: `client:${agentEmail}`,
    To: leadPhone,
    Direction: 'outbound',
    agentEmail,
    leadState: state,
  });

  // 3. VDP heartbeat (fires during call)
  await jsonHit('/api/vdp/heartbeat', { agentEmail });

  // 4. Call status callback (fires when call ends)
  await Promise.all([
    formHit('/api/twilio/call-status', {
      CallSid: callSid,
      CallStatus: 'completed',
      CallDuration: String(Math.floor(30 + Math.random() * 180)),
      From: `client:${agentEmail}`,
      To: leadPhone,
      Direction: 'outbound-api',
      AnsweredBy: 'human',
    }),
    // Child call status
    formHit('/api/twilio/call-status', {
      CallSid: childCallSid,
      ParentCallSid: callSid,
      CallStatus: 'completed',
      CallDuration: String(Math.floor(30 + Math.random() * 180)),
      From: `+1555${String(callId).padStart(7,'0')}`,
      To: leadPhone,
      Direction: 'outbound-api',
    }),
  ]);

  // 5. Agent updates lead resolution (fires when agent submits disposition)
  await jsonHit('/api/hotlead/update-last-contacted', {
    phone: leadPhone.replace('+1',''),
    agentEmail,
    leadId: String(leadId),
  });

  // 6. Usage tracking endpoints
  await Promise.all([
    jsonHit('/api/usage/ccpro-call-end', { agentEmail, callSid }),
    jsonHit('/api/call-connector-pro/activity', {
      agentEmail,
      status: 'idle',
      phoneNumber: null,
    }),
  ]);
}

// ── Simulate concurrent active callers ───────────────────────────────────────
async function callerLoop(callerId, stopAt) {
  let callNum = 0;
  while (Date.now() < stopAt) {
    callNum++;
    await simulateCall(callerId * 1000 + callNum);
    // Wait between calls (realistic pacing — agents don't dial instantly)
    await new Promise(r => setTimeout(r, 3000 + Math.random() * 4000));
  }
}

// ── Progress ──────────────────────────────────────────────────────────────────
function printProgress() {
  const lats = stats.latencies.slice().sort((a,b) => a-b);
  const p50 = lats[Math.floor(lats.length * 0.50)] || 0;
  const p95 = lats[Math.floor(lats.length * 0.95)] || 0;
  const errRate = stats.requests > 0 ? ((stats.errors/stats.requests)*100).toFixed(1) : '0.0';
  process.stdout.write(`\r  📞 Calls flowing | Reqs: ${stats.requests} | ✅ ${stats.success} | ❌ ${stats.errors} (${errRate}%) | ⏱️ ${stats.timeouts} timeouts | p50: ${p50}ms p95: ${p95}ms    `);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🔥 AOIrail Twilio Webhook Stress Test`);
  console.log(`   Target:          ${BASE_URL}`);
  console.log(`   Concurrent callers: ${NUM_CALLS}`);
  console.log(`   Duration:        ${DURATION_SEC}s`);
  console.log(`   Simulating:      Full call lifecycle (initiate → dial-action → call-status → disposition)\n`);

  const warmup = await fetch(`${BASE_URL}/health`).catch(() => null);
  if (!warmup?.ok) { console.error('❌ Server not reachable'); process.exit(1); }
  console.log(`✅ Server reachable\n`);

  const stopAt = Date.now() + DURATION_SEC * 1000;
  const callers = Array.from({ length: NUM_CALLS }, (_, i) => callerLoop(i, stopAt));
  const reporter = setInterval(printProgress, 3000);

  await Promise.all(callers);
  clearInterval(reporter);
  printProgress();

  const lats = stats.latencies.slice().sort((a,b) => a-b);
  const avg = lats.length ? Math.round(lats.reduce((s,v)=>s+v,0)/lats.length) : 0;
  const p50 = lats[Math.floor(lats.length*0.50)]||0;
  const p95 = lats[Math.floor(lats.length*0.95)]||0;
  const p99 = lats[Math.floor(lats.length*0.99)]||0;
  const max = lats[lats.length-1]||0;

  console.log(`\n\n${'═'.repeat(60)}`);
  console.log(`  TWILIO WEBHOOK STRESS TEST RESULTS`);
  console.log(`${'═'.repeat(60)}`);
  console.log(`  Concurrent callers:  ${NUM_CALLS}`);
  console.log(`  Duration:            ${DURATION_SEC}s`);
  console.log(`  Total requests:      ${stats.requests}`);
  console.log(`  Requests/sec:        ${(stats.requests/DURATION_SEC).toFixed(1)}`);
  console.log(`  Success rate:        ${((stats.success/stats.requests)*100).toFixed(1)}%`);
  console.log(`  Errors:              ${stats.errors}`);
  console.log(`  Timeouts (>15s):     ${stats.timeouts}`);
  console.log(`\n  Latency (all endpoints):`);
  console.log(`    avg: ${avg}ms  p50: ${p50}ms  p95: ${p95}ms  p99: ${p99}ms  max: ${max}ms`);
  console.log(`\n  By endpoint (slowest first):`);

  for (const [ep, s] of Object.entries(stats.byEndpoint).sort((a,b)=>b[1].totalMs-a[1].totalMs)) {
    const avgMs = Math.round(s.totalMs/s.count);
    const errPct = ((s.errors/s.count)*100).toFixed(0);
    const flag = avgMs > 2000 ? '🔴' : avgMs > 500 ? '🟡' : '🟢';
    console.log(`  ${flag} ${ep.padEnd(45)} avg:${String(avgMs+'ms').padEnd(8)} max:${s.maxMs}ms err:${errPct}% (${s.count})`);
  }
  console.log(`${'═'.repeat(60)}\n`);

  const errRate = stats.errors/stats.requests;
  if (p95 < 1000 && errRate < 0.02) console.log(`  🟢 EXCELLENT — handles ${NUM_CALLS} concurrent callers cleanly`);
  else if (p95 < 3000 && errRate < 0.05) console.log(`  🟡 ACCEPTABLE — some latency under load`);
  else console.log(`  🔴 NEEDS WORK — bottleneck detected in call flow`);
  console.log();
}

main().catch(console.error);
