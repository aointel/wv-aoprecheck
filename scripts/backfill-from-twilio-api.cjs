/**
 * Pulls today's outbound calls directly from Twilio API (source of truth)
 * and backfills agent_daily_stats on Neon.
 */

const { Pool } = require('pg');
const https = require('https');

const ACCOUNT_SID = 'AC25d37aa41aed0df4fddd81ecf7abf00d';
const AUTH_TOKEN = 'b275d646252457344ff62528e3538ea9';

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }, max: 5
});

const TODAY_PT = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
// Twilio uses StartTime >= date format
const startDate = TODAY_PT; // YYYY-MM-DD
// midnight PT in UTC = 7am UTC
const startUTC = new Date(TODAY_PT + 'T07:00:00.000Z');
const endUTC = new Date(startUTC.getTime() + 86400000);

console.log(`\n📅 Pulling from Twilio API for ${TODAY_PT}`);

function twilioGet(path) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString('base64');
    const url = new URL(`https://api.twilio.com${path}`);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      headers: { 'Authorization': `Basic ${auth}` }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function fetchAllCalls() {
  let allCalls = [];
  // Twilio date filter: StartTime>= and StartTime<
  let path = `/2010-04-01/Accounts/${ACCOUNT_SID}/Calls.json?Direction=outbound-api&StartTime>=${startDate}&PageSize=1000`;
  
  while (path) {
    process.stdout.write(`\r  Fetched ${allCalls.length} calls...`);
    const data = await twilioGet(path);
    if (data.calls) allCalls = allCalls.concat(data.calls);
    path = data.next_page_uri || null;
  }
  console.log(`\r  Fetched ${allCalls.length} calls total`);
  return allCalls;
}

async function run() {
  const calls = await fetchAllCalls();
  console.log(`\n📞 Total outbound calls from Twilio: ${calls.length}`);

  if (calls.length === 0) {
    console.log('No calls found');
    pool.end();
    return;
  }

  // Sample to see structure
  const sample = calls[0];
  console.log(`\nSample call:`);
  console.log(`  from: ${sample.from}`);
  console.log(`  to: ${sample.to}`);
  console.log(`  status: ${sample.status}`);
  console.log(`  duration: ${sample.duration}`);
  console.log(`  start_time: ${sample.start_time}`);

  // Filter to today's PT window
  const todayCalls = calls.filter(c => {
    const t = new Date(c.start_time);
    return t >= startUTC && t < endUTC;
  });
  console.log(`\n📅 Calls within today PT window: ${todayCalls.length}`);

  // Extract agent email from 'from' field: "client:agentname@aoglobelife.com"
  const stats = {};
  let skipped = 0;
  for (const call of todayCalls) {
    let email = null;
    if (call.from && call.from.startsWith('client:')) {
      email = call.from.replace('client:', '').toLowerCase().trim();
    } else if (call.from_formatted && call.from_formatted.includes('@')) {
      email = call.from_formatted.toLowerCase().trim();
    }
    if (!email || !email.includes('@aoglobelife.com')) { skipped++; continue; }

    if (!stats[email]) stats[email] = { dials: 0, reached: 0 };
    stats[email].dials++;
    const dur = Number(call.duration || 0);
    if (dur >= 50) stats[email].reached++;
  }

  console.log(`👥 Agents: ${Object.keys(stats).length}, skipped (no aoglobelife email): ${skipped}`);

  // Show preview
  const sorted = Object.entries(stats).sort((a,b) => b[1].dials - a[1].dials);
  console.log('\nPreview (top 10):');
  sorted.slice(0, 10).forEach(([email, s]) => console.log(`  ${email}: D=${s.dials} R=${s.reached}`));

  // Upsert
  let upserted = 0;
  for (const [email, s] of Object.entries(stats)) {
    await pool.query(`
      INSERT INTO agent_daily_stats (agent_email, stat_date, dials, reached, booked, updated_at)
      VALUES ($1, $2::date, $3, $4, 0, NOW())
      ON CONFLICT (agent_email, stat_date)
      DO UPDATE SET
        dials      = GREATEST(agent_daily_stats.dials,   EXCLUDED.dials),
        reached    = GREATEST(agent_daily_stats.reached, EXCLUDED.reached),
        updated_at = NOW()
    `, [email, TODAY_PT, s.dials, s.reached]);
    upserted++;
  }

  console.log(`\n✅ Upserted ${upserted} agents`);

  const { rows } = await pool.query(`
    SELECT agent_email, dials, reached, booked
    FROM agent_daily_stats WHERE stat_date = $1::date
    ORDER BY dials DESC LIMIT 20
  `, [TODAY_PT]);

  console.log(`\nTop 20 after backfill (${TODAY_PT}):`);
  rows.forEach(r => console.log(`  ${r.agent_email}: D=${r.dials} R=${r.reached} B=${r.booked}`));

  pool.end();
}

run().catch(e => { console.error('Fatal:', e.message); pool.end(); process.exit(1); });
