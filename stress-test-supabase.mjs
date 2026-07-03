import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error(
    'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) before running against prod.',
  );
  process.exit(1);
}
const sb = createClient(supabaseUrl, supabaseKey);

const CONCURRENT = 25;
const DURATION_MS = 30000;
const results = {};
const latencies = {};

function track(name, ms, ok) {
  if (!results[name]) { results[name] = { ok: 0, slow: 0, error: 0 }; latencies[name] = []; }
  latencies[name].push(ms);
  if (!ok) results[name].error++;
  else if (ms > 500) results[name].slow++;
  else results[name].ok++;
}

async function timed(name, fn) {
  const start = Date.now();
  try {
    const { data, error } = await fn();
    const ms = Date.now() - start;
    track(name, ms, !error);
  } catch (e) {
    track(name, Date.now() - start, false);
  }
}

const { data: sampleCustomers } = await sb.from('customers')
  .select('company_email').not('company_email', 'is', null).limit(50);
const emails = sampleCustomers?.map(c => c.company_email).filter(Boolean) || ['cnsysop@aoglobelife.com'];

async function runAgent(i) {
  const end = Date.now() + DURATION_MS;
  const email = emails[i % emails.length];
  while (Date.now() < end) {
    await timed('customers.lookup', () =>
      sb.from('customers').select('associate_id,states,market,VDPACTIVE')
        .or(`company_email.eq.${email},personal_email.eq.${email}`).limit(1));

    await timed('agent_profiles.lookup', () =>
      sb.from('agent_profiles').select('email,first_name,last_name')
        .ilike('email', email).limit(1));

    await timed('live_call_board.read', () =>
      sb.from('live_call_boardt').select('*').limit(1));

    await timed('twilio_call_logs.read', () =>
      sb.from('twilio_call_logs').select('twilio_call_sid,call_started_at,call_duration')
        .eq('owner_email', email).order('call_started_at', { ascending: false }).limit(5));

    if (Math.random() < 0.2) {
      const phone = String(Math.floor(Math.random() * 9000000000) + 1000000000);
      await timed('masterlead.phone_lookup', () =>
        sb.from('masterlead').select('id,state,taalk_market,first_name')
          .ilike('phone', '%' + phone.slice(-10) + '%').limit(1));
    }

    await new Promise(r => setTimeout(r, 1000 + Math.random() * 500));
  }
}

console.log(`🔥 Supabase stress test: ${CONCURRENT} agents for ${DURATION_MS/1000}s`);
console.log(`   customers, agent_profiles, LCB, call_logs, masterlead phone search\n`);

await Promise.all(Array.from({ length: CONCURRENT }, (_, i) => runAgent(i)));

console.log('\n📊 Results:\n');
for (const [name, r] of Object.entries(results)) {
  const lats = latencies[name].sort((a, b) => a - b);
  const avg = Math.round(lats.reduce((a, b) => a + b, 0) / lats.length);
  const p95 = lats[Math.floor(lats.length * 0.95)] || 0;
  const total = r.ok + r.slow + r.error;
  const pct = Math.round(r.slow / total * 100);
  const icon = r.error > 0 ? '🚨' : r.slow > total * 0.2 ? '⚠️' : '✅';
  console.log(`${icon} ${name.padEnd(35)} ok:${r.ok} slow:${r.slow}(${pct}%) err:${r.error} avg:${avg}ms p95:${p95}ms`);
}

const tot = Object.values(results).reduce((s, r) => s + r.ok + r.slow + r.error, 0);
const errs = Object.values(results).reduce((s, r) => s + r.error, 0);
const slow = Object.values(results).reduce((s, r) => s + r.slow, 0);
console.log(`\n📈 Total: ${tot} queries | ${errs} errors | ${slow} slow`);
if (errs > 10) console.log('🚨 High error rate');
else if (slow > tot * 0.2) console.log('⚠️  Latency under load');
else console.log('🟢 Supabase stable');
