/**
 * Reset today's agent_daily_stats and rebuild from scratch:
 * 1. DIALS — deduped distinct phones from Twilio API (agent inbound leg + lead outbound-dial leg joined by parent_call_sid)
 * 2. REACHED — distinct phones where lead leg duration >= 45s
 * 3. BOOKED — from agent_dial_metrics on Neon (event_type='booked')
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
const endUTC   = new Date(startUTC.getTime() + 86400000);

console.log(`\n📅 Rebuilding agent_daily_stats for ${TODAY_PT}`);
console.log(`   UTC window: ${startUTC.toISOString()} → ${endUTC.toISOString()}\n`);

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
    process.stdout.write(`\r  [${direction}] ${all.length} calls...`);
    const data = await twilioGet(path);
    if (data.calls) all = all.concat(data.calls);
    path = data.next_page_uri || null;
  }
  console.log(`\r  [${direction}] Done: ${all.length} total          `);
  return all;
}

async function run() {
  // STEP 1: Reset today
  await pool.query(`DELETE FROM agent_daily_stats WHERE stat_date = $1::date`, [TODAY_PT]);
  console.log(`✅ Reset agent_daily_stats for ${TODAY_PT}\n`);

  // STEP 2: Fetch Twilio call legs in parallel
  const [inboundCalls, outboundCalls] = await Promise.all([
    fetchAll('inbound'),
    fetchAll('outbound-dial')
  ]);

  // Filter to today PT window
  const inToday = inboundCalls.filter(c => {
    const t = new Date(c.start_time || c.date_created);
    return t >= startUTC && t < endUTC;
  });
  const outToday = outboundCalls.filter(c => {
    const t = new Date(c.start_time || c.date_created);
    return t >= startUTC && t < endUTC;
  });

  // Agent legs: inbound with client: identity
  const agentBySid = {};
  for (const leg of inToday) {
    if (leg.from && leg.from.startsWith('client:') && leg.from.includes('@aoglobelife.com')) {
      agentBySid[leg.sid] = leg.from.replace('client:', '').toLowerCase().trim();
    }
  }

  console.log(`\nAgent legs: ${Object.keys(agentBySid).length}`);
  console.log(`Lead legs:  ${outToday.filter(c => c.parent_call_sid).length}`);

  // STEP 3: Per agent — map phone -> max duration
  const agentPhoneMax = {}; // email -> { phone -> maxDuration }

  for (const leg of outToday) {
    const email = agentBySid[leg.parent_call_sid];
    if (!email) continue;
    const phone = (leg.to || '').replace(/\D/g, '').slice(-10);
    if (!phone || phone.length < 7) continue;
    const dur = Number(leg.duration || 0);
    if (!agentPhoneMax[email]) agentPhoneMax[email] = {};
    agentPhoneMax[email][phone] = Math.max(agentPhoneMax[email][phone] || 0, dur);
  }

  // STEP 4: Calculate deduped dials + reached
  const stats = {};
  for (const [email, phoneMap] of Object.entries(agentPhoneMax)) {
    const phones = Object.keys(phoneMap);
    stats[email] = {
      dials:   phones.length,
      reached: phones.filter(p => phoneMap[p] >= 45).length,
      booked:  0
    };
  }

  console.log(`\n👥 Agents with dial data: ${Object.keys(stats).length}`);

  // STEP 5: Booked from Neon agent_dial_metrics
  const { rows: bookedRows } = await pool.query(`
    SELECT LOWER(TRIM(agent_email)) AS email, COUNT(*) AS cnt
    FROM agent_dial_metrics
    WHERE event_timestamp >= $1::date
      AND event_timestamp <  $1::date + INTERVAL '1 day'
      AND LOWER(event_type) = 'booked'
      AND agent_email IS NOT NULL AND agent_email != ''
    GROUP BY LOWER(TRIM(agent_email))
  `, [TODAY_PT]);

  for (const row of bookedRows) {
    if (!stats[row.email]) stats[row.email] = { dials: 0, reached: 0, booked: 0 };
    stats[row.email].booked = Number(row.cnt);
  }
  console.log(`📋 Agents with booked data from Neon: ${bookedRows.length}`);

  // STEP 6: Upsert everything
  let upserted = 0;
  for (const [email, s] of Object.entries(stats)) {
    await pool.query(`
      INSERT INTO agent_daily_stats (agent_email, stat_date, dials, reached, booked, updated_at)
      VALUES ($1, $2::date, $3, $4, $5, NOW())
      ON CONFLICT (agent_email, stat_date)
      DO UPDATE SET
        dials      = EXCLUDED.dials,
        reached    = EXCLUDED.reached,
        booked     = GREATEST(agent_daily_stats.booked, EXCLUDED.booked),
        updated_at = NOW()
    `, [email, TODAY_PT, s.dials, s.reached, s.booked]);
    upserted++;
  }

  console.log(`\n✅ Upserted ${upserted} agents\n`);

  // Final results
  const { rows } = await pool.query(`
    SELECT agent_email, dials, reached, booked
    FROM agent_daily_stats WHERE stat_date = $1::date
    ORDER BY dials DESC LIMIT 25
  `, [TODAY_PT]);

  console.log(`Top 25 (${TODAY_PT}):`);
  rows.forEach(r => console.log(`  ${r.agent_email}: D=${r.dials} R=${r.reached} B=${r.booked}`));

  pool.end();
}

run().catch(e => { console.error('Fatal:', e.message); pool.end(); process.exit(1); });
