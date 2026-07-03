/**
 * AOIrail FULL LOAD Test
 * Simulates real concurrent usage:
 * - Agents polling panel-data, credits, heartbeats every 5s
 * - Active callers doing full call lifecycle simultaneously
 * - Masterlead/hotlead reads during active dialing
 * - VDP heartbeats, credit checks, profile loads
 *
 * Usage:
 *   node stress-test-full.mjs --agents=100 --callers=30 --duration=60
 */

import crypto from 'crypto';

const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace('--','').split('=')));
const BASE_URL = args.url || 'https://aoirail-production.up.railway.app';
const NUM_AGENTS = parseInt(args.agents || '100');   // agents sitting on dashboard
const NUM_CALLERS = parseInt(args.callers || '30');   // agents actively dialing
const DURATION_SEC = parseInt(args.duration || '60');

const MARKETS = ['globe','veteran','aorecruit'];
const STATES = ['PA','VA','TN','OH','NC','FL','TX','CA','GA','IN','MD','NJ'];
const LEAD_PHONES = Array.from({ length: 500 }, (_, i) => `555${String(i).padStart(7,'0')}`);

function rand(arr) { return arr[Math.floor(Math.random()*arr.length)]; }
function randomSid(p='CA') { return p+crypto.randomBytes(16).toString('hex'); }
function agentEmail(i) { return `loadtest_${i}@aoglobelife.com`; }

// ── Stats ─────────────────────────────────────────────────────────────────────
const stats = { requests:0, success:0, errors:0, timeouts:0, latencies:[], byEndpoint:{} };
function record(ep, ms, ok) {
  stats.requests++; ok ? stats.success++ : stats.errors++;
  stats.latencies.push(ms);
  if (!stats.byEndpoint[ep]) stats.byEndpoint[ep] = {count:0,errors:0,totalMs:0,maxMs:0};
  const s = stats.byEndpoint[ep];
  s.count++; s.totalMs+=ms; if(ms>s.maxMs) s.maxMs=ms; if(!ok) s.errors++;
}

async function hit(ep, opts={}) {
  const url = BASE_URL+ep;
  const start = Date.now();
  try {
    const res = await fetch(url, { signal:AbortSignal.timeout(15000), ...opts });
    const ms = Date.now()-start;
    const ok = res.status < 500;
    record(ep.split('?')[0], ms, ok);
    return { ok, status:res.status, ms };
  } catch(e) {
    const ms = Date.now()-start;
    if(e.name==='TimeoutError') stats.timeouts++;
    record(ep.split('?')[0], ms, false);
    return { ok:false, status:0, ms };
  }
}

function json(ep, body, method='POST') {
  return hit(ep, { method, body:JSON.stringify(body), headers:{'Content-Type':'application/json'} });
}
function form(ep, body) {
  const encoded = Object.entries(body).map(([k,v])=>`${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  return hit(ep, { method:'POST', body:encoded, headers:{'Content-Type':'application/x-www-form-urlencoded'} });
}
function get(ep, email) {
  return hit(ep, { headers:{'x-user-email':email} });
}

// ── AGENT DASHBOARD LOOP (polling panel, credits, heartbeats) ─────────────────
async function agentDashboard(id, stopAt) {
  const email = agentEmail(id);
  const market = rand(MARKETS);
  let tick = 0;

  while (Date.now() < stopAt) {
    tick++;
    const polls = [
      hit(`/api/agent/panel-data?email=${encodeURIComponent(email)}&market=${market}`),
      hit(`/api/twilio/taskrouter/pending?agentEmail=${encodeURIComponent(email)}`),
      hit(`/api/diagnostics/proxy/live-queue`),
      hit(`/health`),
      json(`/api/vdp/heartbeat`, { agentEmail: email }),
    ];

    if (tick % 2 === 0) {
      polls.push(
        get(`/api/user/credit-status?email=${encodeURIComponent(email)}`, email),
        get(`/api/user/credits`, email),
      );
    }

    if (tick % 3 === 0) {
      polls.push(
        json(`/api/usage/heartbeat`, { userEmail:email, page:'dashboard', action:'none' }),
        json(`/api/call-connector-pro/heartbeat`, { agentEmail:email }),
        get(`/api/call-connector-pro/eligible-for-inbound`, email),
      );
    }

    if (tick % 6 === 0) {
      polls.push(
        get(`/api/agent/profile-direct`, email),
        get(`/api/help/bookings/upcoming`, email),
        hit(`/api/aoi-reports/check-blocking/${encodeURIComponent(email)}`),
      );
    }

    await Promise.all(polls);
    await new Promise(r => setTimeout(r, 4500 + Math.random()*1000));
  }
}

// ── ACTIVE CALLER LOOP (full call lifecycle) ──────────────────────────────────
async function activeCaller(id, stopAt) {
  const email = agentEmail(id + NUM_AGENTS); // separate email pool from dashboards
  let callNum = 0;

  while (Date.now() < stopAt) {
    callNum++;
    const callSid = randomSid();
    const childCallSid = randomSid();
    const leadPhone = rand(LEAD_PHONES);
    const state = rand(STATES);
    const leadId = Math.floor(Math.random()*900000)+100000;
    const duration = Math.floor(30 + Math.random()*180);

    // Initiate call
    await json('/api/outbound-dialer/initiate-call', {
      agentEmail: email, leadPhone, leadState: state,
      leadId: String(leadId), leadName: `Lead ${callNum}`, market: 'Globe',
    });

    await new Promise(r => setTimeout(r, 200 + Math.random()*300));

    // During call — agent dashboard still polling
    await Promise.all([
      hit(`/api/agent/panel-data?email=${encodeURIComponent(email)}&market=globe`),
      json('/api/vdp/heartbeat', { agentEmail: email }),
      json('/api/call-connector-pro/activity', {
        agentEmail: email, status: 'live',
        phoneNumber: leadPhone, direction: 'outbound',
      }),
    ]);

    await new Promise(r => setTimeout(r, 100 + Math.random()*200));

    // Call ends — Twilio fires webhooks simultaneously
    await Promise.all([
      // dial-action
      form('/api/twilio/dial-action', {
        CallSid: callSid, DialCallSid: childCallSid,
        DialCallStatus: 'completed', DialCallDuration: String(duration),
        From: `client:${email}`, To: leadPhone,
        Direction: 'outbound', agentEmail: email, leadState: state,
      }),
      // parent call-status
      form('/api/twilio/call-status', {
        CallSid: callSid, CallStatus: 'completed', CallDuration: String(duration),
        From: `client:${email}`, To: leadPhone, Direction: 'outbound-api',
      }),
      // child call-status
      form('/api/twilio/call-status', {
        CallSid: childCallSid, ParentCallSid: callSid,
        CallStatus: 'completed', CallDuration: String(duration),
        From: `+17178880001`, To: leadPhone, Direction: 'outbound-api',
      }),
    ]);

    // Agent submits disposition
    await Promise.all([
      json('/api/hotlead/update-last-contacted', {
        phone: leadPhone, agentEmail: email, leadId: String(leadId),
      }),
      json('/api/usage/ccpro-call-end', { agentEmail: email, callSid }),
      json('/api/call-connector-pro/activity', {
        agentEmail: email, status: 'idle', phoneNumber: null,
      }),
    ]);

    // Wait before next call
    await new Promise(r => setTimeout(r, 2000 + Math.random()*3000));
  }
}

// ── Progress ──────────────────────────────────────────────────────────────────
function printProgress(elapsed) {
  const lats = stats.latencies.slice().sort((a,b)=>a-b);
  const p50 = lats[Math.floor(lats.length*0.50)]||0;
  const p95 = lats[Math.floor(lats.length*0.95)]||0;
  const errRate = stats.requests > 0 ? ((stats.errors/stats.requests)*100).toFixed(1) : '0.0';
  const rps = (stats.requests/elapsed).toFixed(0);
  process.stdout.write(`\r  ⚡ ${elapsed}s | Reqs: ${stats.requests} (${rps}/s) | ✅ ${stats.success} | ❌ ${stats.errors} (${errRate}%) | ⏱️ ${stats.timeouts} | p50:${p50}ms p95:${p95}ms    `);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n⚡ AOIrail FULL LOAD TEST`);
  console.log(`   Target:           ${BASE_URL}`);
  console.log(`   Dashboard agents: ${NUM_AGENTS} (polling every 5s)`);
  console.log(`   Active callers:   ${NUM_CALLERS} (full call lifecycle)`);
  console.log(`   Total simulated:  ${NUM_AGENTS + NUM_CALLERS} concurrent agents`);
  console.log(`   Duration:         ${DURATION_SEC}s\n`);

  const warmup = await fetch(`${BASE_URL}/health`).catch(()=>null);
  if (!warmup?.ok) { console.error('❌ Server not reachable'); process.exit(1); }
  console.log(`✅ Server up\n`);

  const stopAt = Date.now() + DURATION_SEC*1000;
  const startTime = Date.now();

  // Launch all loops
  const loops = [
    ...Array.from({length:NUM_AGENTS}, (_,i) => agentDashboard(i, stopAt)),
    ...Array.from({length:NUM_CALLERS}, (_,i) => activeCaller(i, stopAt)),
  ];

  const reporter = setInterval(() => printProgress(Math.floor((Date.now()-startTime)/1000)), 3000);
  await Promise.all(loops);
  clearInterval(reporter);
  printProgress(DURATION_SEC);

  // ── Report ──────────────────────────────────────────────────────────────────
  const lats = stats.latencies.slice().sort((a,b)=>a-b);
  const avg = lats.length ? Math.round(lats.reduce((s,v)=>s+v,0)/lats.length) : 0;
  const p50 = lats[Math.floor(lats.length*0.50)]||0;
  const p95 = lats[Math.floor(lats.length*0.95)]||0;
  const p99 = lats[Math.floor(lats.length*0.99)]||0;
  const max = lats[lats.length-1]||0;
  const rps = (stats.requests/DURATION_SEC).toFixed(1);

  console.log(`\n\n${'═'.repeat(65)}`);
  console.log(`  FULL LOAD TEST RESULTS`);
  console.log(`${'═'.repeat(65)}`);
  console.log(`  Dashboard agents:    ${NUM_AGENTS}`);
  console.log(`  Active callers:      ${NUM_CALLERS}`);
  console.log(`  Total agents:        ${NUM_AGENTS+NUM_CALLERS}`);
  console.log(`  Duration:            ${DURATION_SEC}s`);
  console.log(`  Total requests:      ${stats.requests}`);
  console.log(`  Requests/sec:        ${rps}`);
  console.log(`  Success rate:        ${((stats.success/stats.requests)*100).toFixed(2)}%`);
  console.log(`  Errors:              ${stats.errors}`);
  console.log(`  Timeouts (>15s):     ${stats.timeouts}`);
  console.log(`\n  Latency:`);
  console.log(`    avg:${avg}ms  p50:${p50}ms  p95:${p95}ms  p99:${p99}ms  max:${max}ms`);
  console.log(`\n  Endpoints (slowest first):`);

  const sorted = Object.entries(stats.byEndpoint).sort((a,b)=>b[1].totalMs-a[1].totalMs);
  for (const [ep, s] of sorted) {
    const avgMs = Math.round(s.totalMs/s.count);
    const errPct = ((s.errors/s.count)*100).toFixed(0);
    const flag = avgMs>3000?'🔴':avgMs>1000?'🟠':avgMs>500?'🟡':'🟢';
    console.log(`  ${flag} ${ep.padEnd(48)} avg:${String(avgMs+'ms').padEnd(9)}max:${s.maxMs}ms err:${errPct}% (${s.count})`);
  }
  console.log(`${'═'.repeat(65)}\n`);

  const errRate = stats.errors/stats.requests;
  if (p95<1000 && errRate<0.02) console.log(`  🟢 EXCELLENT — server handles ${NUM_AGENTS+NUM_CALLERS} concurrent agents cleanly`);
  else if (p95<3000 && errRate<0.05) console.log(`  🟡 ACCEPTABLE — some pressure under full load`);
  else console.log(`  🔴 BOTTLENECK — needs more work`);
  console.log();
}

main().catch(console.error);
