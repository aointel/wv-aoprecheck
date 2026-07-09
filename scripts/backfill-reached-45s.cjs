/**
 * Recalculates reached from Twilio API using 45 second threshold.
 * Updates agent_daily_stats reached counts.
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
const startUTC = new Date(TODAY_PT + 'T07:00:00.000Z');
const endUTC = new Date(startUTC.getTime() + 86400000);

function twilioGet(path) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString('base64');
    const url = new URL(`https://api.twilio.com${path}`);
    const req = https.request({
      hostname: url.hostname, path: url.pathname + url.search, method: 'GET',
      headers: { 'Authorization': `Basic ${auth}` }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { reject(e); } });
    });
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  console.log(`\n📅 Recalculating reached (>=45s) from Twilio for ${TODAY_PT}\n`);

  let allCalls = [];
  let path = `/2010-04-01/Accounts/${ACCOUNT_SID}/Calls.json?Direction=outbound-api&StartTime>=${TODAY_PT}&PageSize=1000`;
  while (path) {
    process.stdout.write(`\r  Fetching... ${allCalls.length} calls`);
    const data = await twilioGet(path);
    if (data.calls) allCalls = allCalls.concat(data.calls);
    path = data.next_page_uri || null;
  }
  console.log(`\r  Total: ${allCalls.length} calls`);

  // Filter to today PT window
  const todayCalls = allCalls.filter(c => {
    const t = new Date(c.start_time);
    return t >= startUTC && t < endUTC;
  });

  // Aggregate reached per agent using 45s threshold
  const reached = {};
  for (const call of todayCalls) {
    if (!call.from || !call.from.startsWith('client:')) continue;
    const email = call.from.replace('client:', '').toLowerCase().trim();
    if (!email.includes('@aoglobelife.com')) continue;
    if (!reached[email]) reached[email] = 0;
    if (Number(call.duration || 0) >= 45) reached[email]++;
  }

  console.log(`\n👥 Agents with reached data: ${Object.keys(reached).length}`);

  // Preview
  const sorted = Object.entries(reached).sort((a,b) => b[1]-a[1]);
  console.log('Top 15 reached:');
  sorted.slice(0,15).forEach(([e,r]) => console.log(`  ${e}: R=${r}`));

  // Reset reached for all agents today, then set real values
  await pool.query(`UPDATE agent_daily_stats SET reached = 0, updated_at = NOW() WHERE stat_date = $1::date`, [TODAY_PT]);

  for (const [email, r] of Object.entries(reached)) {
    await pool.query(`
      INSERT INTO agent_daily_stats (agent_email, stat_date, dials, reached, booked, updated_at)
      VALUES ($1, $2::date, 0, $3, 0, NOW())
      ON CONFLICT (agent_email, stat_date)
      DO UPDATE SET reached = GREATEST(agent_daily_stats.reached, EXCLUDED.reached), updated_at = NOW()
    `, [email, TODAY_PT, r]);
  }

  console.log(`\n✅ Updated reached for ${Object.keys(reached).length} agents`);

  const { rows } = await pool.query(`
    SELECT agent_email, dials, reached, booked FROM agent_daily_stats
    WHERE stat_date = $1::date ORDER BY dials DESC LIMIT 20
  `, [TODAY_PT]);

  console.log(`\nFinal top 20 (${TODAY_PT}):`);
  rows.forEach(r => console.log(`  ${r.agent_email}: D=${r.dials} R=${r.reached} B=${r.booked}`));
  pool.end();
}

run().catch(e => { console.error(e.message); pool.end(); process.exit(1); });
