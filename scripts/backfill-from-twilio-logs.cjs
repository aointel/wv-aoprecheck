/**
 * Backfill today's DRB from twilio_call_logs on Supabase (most complete source)
 */

const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }, max: 5
});

// Use service role JWT (decoded from hardcoded-config)
const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.Q-B-d4nW5YVfD9A_Ue8lHJGrYhfCiB3xWD1Ws7JiEig',
  { auth: { persistSession: false } }
);

const TODAY_PT = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
// PST start of today in UTC
const startUTC = new Date(TODAY_PT + 'T07:00:00.000Z').toISOString(); // 12am PT = 7am UTC
const endUTC   = new Date(TODAY_PT + 'T07:00:00.000Z');
endUTC.setDate(endUTC.getDate() + 1);

console.log(`\n📅 Backfilling from twilio_call_logs for ${TODAY_PT}`);
console.log(`   UTC window: ${startUTC} → ${endUTC.toISOString()}\n`);

async function run() {
  // Check columns
  const { data: sample } = await supabase.from('twilio_call_logs').select('*').limit(1);
  if (sample && sample.length > 0) console.log('twilio_call_logs columns:', Object.keys(sample[0]).join(', '));

  // Fetch today's outbound calls
  let allCalls = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('twilio_call_logs')
      .select('owner_email, call_direction, call_duration, call_status, call_started_at')
      .eq('call_direction', 'outbound')
      .gte('call_started_at', startUTC)
      .lt('call_started_at', endUTC.toISOString())
      .not('owner_email', 'is', null)
      .range(from, from + PAGE - 1);

    if (error) { console.error('Error:', error.message); break; }
    if (!data || data.length === 0) break;
    allCalls = allCalls.concat(data);
    console.log(`  Fetched ${allCalls.length} rows...`);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  console.log(`\n📞 Total outbound calls today: ${allCalls.length}`);

  // Aggregate
  const stats = {};
  for (const call of allCalls) {
    const email = (call.owner_email || '').toLowerCase().trim();
    if (!email || !email.includes('@')) continue;
    if (!stats[email]) stats[email] = { dials: 0, reached: 0, booked: 0 };
    stats[email].dials++;
    const dur = Number(call.call_duration || 0);
    if (dur >= 50) stats[email].reached++;
  }

  console.log(`👥 Unique agents: ${Object.keys(stats).length}`);

  // Upsert — use GREATEST to not overwrite direct-write counts
  let upserted = 0;
  for (const [email, s] of Object.entries(stats)) {
    await pool.query(`
      INSERT INTO agent_daily_stats (agent_email, stat_date, dials, reached, updated_at)
      VALUES ($1, $2::date, $3, $4, NOW())
      ON CONFLICT (agent_email, stat_date)
      DO UPDATE SET
        dials   = GREATEST(agent_daily_stats.dials,   EXCLUDED.dials),
        reached = GREATEST(agent_daily_stats.reached, EXCLUDED.reached),
        updated_at = NOW()
    `, [email, TODAY_PT, s.dials, s.reached]);
    upserted++;
  }

  console.log(`✅ Upserted ${upserted} agents`);

  // Show top 15
  const { rows } = await pool.query(`
    SELECT agent_email, dials, reached, booked FROM agent_daily_stats
    WHERE stat_date = $1::date ORDER BY dials DESC LIMIT 15
  `, [TODAY_PT]);

  console.log(`\nTop 15 after backfill:`);
  rows.forEach(r => console.log(`  ${r.agent_email}: D=${r.dials} R=${r.reached} B=${r.booked}`));

  pool.end();
}

run().catch(e => { console.error(e.message); pool.end(); });
