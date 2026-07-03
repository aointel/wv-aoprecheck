/**
 * Recalculates dials deduped by phone number (distinct to numbers per agent).
 * If an agent calls the same number twice, counts as 1 dial.
 * Reached: at least one call to that number lasted >= 45s.
 */

const { Pool } = require('pg');
const https = require('https');

const ACCOUNT_SID = 'AC25d37aa41aed0df4fddd81ecf7abf00d';
const AUTH_TOKEN = '974557c999ed53ada16c4a784af2a7d3';

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
  console.log(`\n📅 Deduped dial/reached recalc for ${TODAY_PT} (distinct phone per agent)\n`);

  let allCalls = [];
  let path = `/2010-04-01/Accounts/${ACCOUNT_SID}/Calls.json?Direction=outbound-api&StartTime>=${TODAY_PT}&PageSize=1000`;
  while (path) {
    process.stdout.write(`\r  Fetching... ${allCalls.length}`);
    const data = await twilioGet(path);
    if (data.calls) allCalls = allCalls.concat(data.calls);
    path = data.next_page_uri || null;
  }
  console.log(`\r  Total calls fetched: ${allCalls.length}`);

  // Filter to today PT
  const todayCalls = allCalls.filter(c => {
    const t = new Date(c.start_time);
    return t >= startUTC && t < endUTC;
  });
  console.log(`  Today's calls: ${todayCalls.length}`);

  // Per agent, track SET of distinct phones dialed and SET of phones reached (>=45s)
  const agentPhones = {};   // email -> Set of phones dialed
  const agentReached = {};  // email -> Set of phones with >=45s call

  for (const call of todayCalls) {
    if (!call.from || !call.from.startsWith('client:')) continue;
    const email = call.from.replace('client:', '').toLowerCase().trim();
    if (!email.includes('@aoglobelife.com')) continue;
    const phone = (call.to || '').replace(/\D/g, '').slice(-10); // normalize to last 10 digits
    if (!phone || phone.length < 7) continue;

    if (!agentPhones[email]) agentPhones[email] = new Set();
    if (!agentReached[email]) agentReached[email] = new Set();

    agentPhones[email].add(phone);
    if (Number(call.duration || 0) >= 45) agentReached[email].add(phone);
  }

  const agents = Object.keys(agentPhones);
  console.log(`\n👥 Agents: ${agents.length}`);

  // Preview top 15
  const sorted = agents.sort((a,b) => agentPhones[b].size - agentPhones[a].size);
  console.log('Top 15 (deduped):');
  sorted.slice(0,15).forEach(e => {
    console.log(`  ${e}: D=${agentPhones[e].size} R=${agentReached[e]?.size || 0}`);
  });

  // Upsert — overwrite dials and reached with deduped values, keep booked
  let upserted = 0;
  for (const email of agents) {
    const dials = agentPhones[email].size;
    const reached = agentReached[email]?.size || 0;
    await pool.query(`
      INSERT INTO agent_daily_stats (agent_email, stat_date, dials, reached, booked, updated_at)
      VALUES ($1, $2::date, $3, $4, 0, NOW())
      ON CONFLICT (agent_email, stat_date)
      DO UPDATE SET
        dials      = $3,
        reached    = $4,
        updated_at = NOW()
    `, [email, TODAY_PT, dials, reached]);
    upserted++;
  }

  console.log(`\n✅ Upserted ${upserted} agents (deduped by distinct phone)`);

  const { rows } = await pool.query(`
    SELECT agent_email, dials, reached, booked FROM agent_daily_stats
    WHERE stat_date = $1::date ORDER BY dials DESC LIMIT 20
  `, [TODAY_PT]);

  console.log(`\nFinal top 20 (${TODAY_PT}):`);
  rows.forEach(r => console.log(`  ${r.agent_email}: D=${r.dials} R=${r.reached} B=${r.booked}`));
  pool.end();
}

run().catch(e => { console.error(e.message); pool.end(); process.exit(1); });
