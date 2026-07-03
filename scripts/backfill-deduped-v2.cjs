/**
 * Correct deduped backfill using Twilio call pairs.
 * Agent leg: direction=inbound, from=client:email (parent)
 * Lead leg:  direction=outbound-dial, parent_call_sid=agent.sid, to=lead phone, duration=actual
 *
 * Deduped by distinct lead phone per agent.
 * Reached = distinct phones where at least one call >= 45s.
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
const endUTC   = new Date(startUTC.getTime() + 86400000);

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

async function fetchAll(direction) {
  let all = [];
  let path = `/2010-04-01/Accounts/${ACCOUNT_SID}/Calls.json?Direction=${direction}&StartTime>=${TODAY_PT}&PageSize=1000`;
  while (path) {
    process.stdout.write(`\r  [${direction}] Fetched ${all.length}...`);
    const data = await twilioGet(path);
    if (data.calls) all = all.concat(data.calls);
    path = data.next_page_uri || null;
  }
  console.log(`\r  [${direction}] Total: ${all.length}          `);
  return all;
}

async function run() {
  console.log(`\n📅 Deduped backfill (correct pair matching) for ${TODAY_PT}\n`);

  // Fetch both legs
  const [inboundCalls, outboundCalls] = await Promise.all([
    fetchAll('inbound'),
    fetchAll('outbound-dial')
  ]);

  // Filter to today PT window
  const todayFilter = c => {
    const t = new Date(c.start_time || c.date_created);
    return t >= startUTC && t < endUTC;
  };

  const agentLegs = inboundCalls.filter(todayFilter).filter(c =>
    c.from && c.from.startsWith('client:') && c.from.includes('@aoglobelife.com')
  );
  const leadLegs = outboundCalls.filter(todayFilter).filter(c =>
    c.parent_call_sid && c.to && c.to.startsWith('+')
  );

  console.log(`Agent legs today: ${agentLegs.length}`);
  console.log(`Lead legs today:  ${leadLegs.length}`);

  // Build lookup: agent_leg_sid -> agent_email
  const agentBySid = {};
  for (const leg of agentLegs) {
    const email = leg.from.replace('client:', '').toLowerCase().trim();
    agentBySid[leg.sid] = email;
  }

  // Per agent: Map of phone -> max duration
  const agentPhoneMaxDuration = {}; // email -> { phone -> maxDuration }

  for (const leg of leadLegs) {
    const email = agentBySid[leg.parent_call_sid];
    if (!email) continue;
    const phone = leg.to.replace(/\D/g, '').slice(-10);
    if (!phone || phone.length < 7) continue;
    const dur = Number(leg.duration || 0);

    if (!agentPhoneMaxDuration[email]) agentPhoneMaxDuration[email] = {};
    const prev = agentPhoneMaxDuration[email][phone] || 0;
    agentPhoneMaxDuration[email][phone] = Math.max(prev, dur);
  }

  const agents = Object.keys(agentPhoneMaxDuration);
  console.log(`\n👥 Matched agents: ${agents.length}`);

  // Calculate deduped dials and reached
  const stats = {};
  for (const [email, phoneMap] of Object.entries(agentPhoneMaxDuration)) {
    const phones = Object.keys(phoneMap);
    const dials = phones.length;
    const reached = phones.filter(p => phoneMap[p] >= 45).length;
    stats[email] = { dials, reached };
  }

  // Preview top 15
  const sorted = Object.entries(stats).sort((a,b) => b[1].dials - a[1].dials);
  console.log('\nTop 15 (deduped):');
  sorted.slice(0,15).forEach(([e, s]) => console.log(`  ${e}: D=${s.dials} R=${s.reached}`));

  // Upsert — overwrite dials + reached, keep booked
  let upserted = 0;
  for (const [email, s] of Object.entries(stats)) {
    await pool.query(`
      INSERT INTO agent_daily_stats (agent_email, stat_date, dials, reached, booked, updated_at)
      VALUES ($1, $2::date, $3, $4, 0, NOW())
      ON CONFLICT (agent_email, stat_date)
      DO UPDATE SET
        dials      = $3,
        reached    = $4,
        updated_at = NOW()
    `, [email, TODAY_PT, s.dials, s.reached]);
    upserted++;
  }

  console.log(`\n✅ Upserted ${upserted} agents (deduped by distinct lead phone)`);

  const { rows } = await pool.query(`
    SELECT agent_email, dials, reached, booked FROM agent_daily_stats
    WHERE stat_date = $1::date ORDER BY dials DESC LIMIT 20
  `, [TODAY_PT]);

  console.log(`\nFinal top 20 (${TODAY_PT}):`);
  rows.forEach(r => console.log(`  ${r.agent_email}: D=${r.dials} R=${r.reached} B=${r.booked}`));
  pool.end();
}

run().catch(e => { console.error(e.message); pool.end(); process.exit(1); });
