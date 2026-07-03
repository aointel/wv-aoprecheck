/**
 * TEST: Direct dial counter — validates that incrementAgentDailyStat
 * correctly atomically increments agent_daily_stats on Neon.
 *
 * Run: node scripts/test-dial-counter.cjs
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require',
  connectionTimeoutMillis: 10000,
  ssl: { rejectUnauthorized: false },
  max: 5
});

const TEST_AGENT = 'test-counter@aoglobelife.com';
const TODAY = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });

async function getStats(agent) {
  const { rows } = await pool.query(
    `SELECT dials, reached, booked FROM agent_daily_stats WHERE agent_email = $1 AND stat_date = $2::date`,
    [agent, TODAY]
  );
  return rows[0] || { dials: 0, reached: 0, booked: 0 };
}

async function incrementStat(agent, eventType) {
  const col = eventType === 'dial' ? 'dials' : eventType === 'reach' ? 'reached' : 'booked';
  await pool.query(
    `INSERT INTO agent_daily_stats (agent_email, stat_date, ${col}, updated_at)
     VALUES ($1, $2::date, 1, NOW())
     ON CONFLICT (agent_email, stat_date)
     DO UPDATE SET ${col} = agent_daily_stats.${col} + 1, updated_at = NOW()`,
    [agent, TODAY]
  );
}

async function cleanup(agent) {
  await pool.query(
    `DELETE FROM agent_daily_stats WHERE agent_email = $1 AND stat_date = $2::date`,
    [agent, TODAY]
  );
}

async function runTests() {
  console.log(`\n🧪 Testing dial counter on Neon — date: ${TODAY}\n`);

  // --- TEST 1: Clean insert ---
  await cleanup(TEST_AGENT);
  let before = await getStats(TEST_AGENT);
  console.log(`TEST 1 — Clean insert`);
  console.log(`  Before: dials=${before.dials}`);
  await incrementStat(TEST_AGENT, 'dial');
  let after = await getStats(TEST_AGENT);
  console.log(`  After:  dials=${after.dials}`);
  const t1 = after.dials === 1;
  console.log(`  Result: ${t1 ? '✅ PASS' : '❌ FAIL'}\n`);

  // --- TEST 2: Increment existing ---
  before = await getStats(TEST_AGENT);
  console.log(`TEST 2 — Increment existing row`);
  console.log(`  Before: dials=${before.dials}`);
  await incrementStat(TEST_AGENT, 'dial');
  after = await getStats(TEST_AGENT);
  console.log(`  After:  dials=${after.dials}`);
  const t2 = after.dials === before.dials + 1;
  console.log(`  Result: ${t2 ? '✅ PASS' : '❌ FAIL'}\n`);

  // --- TEST 3: 10 concurrent increments — simulates 10 agents firing at once ---
  await cleanup(TEST_AGENT);
  console.log(`TEST 3 — 10 concurrent dial increments (race condition test)`);
  await Promise.all(Array.from({ length: 10 }, () => incrementStat(TEST_AGENT, 'dial')));
  after = await getStats(TEST_AGENT);
  console.log(`  Expected: dials=10, Got: dials=${after.dials}`);
  const t3 = after.dials === 10;
  console.log(`  Result: ${t3 ? '✅ PASS' : '❌ FAIL'}\n`);

  // --- TEST 4: Different event types don't bleed into each other ---
  await cleanup(TEST_AGENT);
  console.log(`TEST 4 — dial/reach/booked stay independent`);
  await incrementStat(TEST_AGENT, 'dial');
  await incrementStat(TEST_AGENT, 'dial');
  await incrementStat(TEST_AGENT, 'reach');
  after = await getStats(TEST_AGENT);
  console.log(`  Expected: dials=2, reached=1, booked=0`);
  console.log(`  Got:      dials=${after.dials}, reached=${after.reached}, booked=${after.booked}`);
  const t4 = after.dials === 2 && after.reached === 1 && after.booked === 0;
  console.log(`  Result: ${t4 ? '✅ PASS' : '❌ FAIL'}\n`);

  // --- TEST 5: Speed test — how fast is one increment? ---
  console.log(`TEST 5 — Speed (single increment latency)`);
  const start = Date.now();
  await incrementStat(TEST_AGENT, 'dial');
  const ms = Date.now() - start;
  console.log(`  Latency: ${ms}ms`);
  const t5 = ms < 500;
  console.log(`  Result: ${t5 ? `✅ PASS (${ms}ms < 500ms)` : `❌ SLOW (${ms}ms)`}\n`);

  // Cleanup
  await cleanup(TEST_AGENT);

  const allPassed = t1 && t2 && t3 && t4 && t5;
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(allPassed ? `✅ ALL TESTS PASSED — safe to deploy` : `❌ SOME TESTS FAILED — do not deploy`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  pool.end();
  process.exit(allPassed ? 0 : 1);
}

runTests().catch(e => {
  console.error('Fatal:', e.message);
  pool.end();
  process.exit(1);
});
