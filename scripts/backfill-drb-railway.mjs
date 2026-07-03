/**
 * Backfills today's DRB from twilio_call_logs (Supabase) into agent_daily_stats (Neon).
 * Uses created_at as the date filter since that's reliably set.
 */

import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

const { Pool } = pg;

const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 5 });

const TODAY_PT = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
// midnight PT = 7am UTC
const startUTC = new Date(TODAY_PT + 'T07:00:00.000Z');
const endUTC = new Date(startUTC.getTime() + 86400000);

console.log(`\n📅 Backfilling DRB for ${TODAY_PT}`);
console.log(`   UTC window: ${startUTC.toISOString()} → ${endUTC.toISOString()}\n`);

async function run() {
  // Try both created_at and call_started_at
  let allCalls = [];
  let from = 0;
  const PAGE = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('twilio_call_logs')
      .select('owner_email, call_duration, call_status, created_at')
      .eq('call_direction', 'outbound')
      .gte('created_at', startUTC.toISOString())
      .lt('created_at', endUTC.toISOString())
      .not('owner_email', 'is', null)
      .range(from, from + PAGE - 1);

    if (error) { console.error('Supabase error:', error.message); break; }
    if (!data || data.length === 0) break;
    allCalls = allCalls.concat(data);
    process.stdout.write(`\r  Fetched ${allCalls.length} rows...`);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  console.log(`\n📞 Total outbound calls today: ${allCalls.length}`);

  if (allCalls.length === 0) {
    console.log('⚠️  No calls in twilio_call_logs today — HOT_TABLES_EOD_ONLY was blocking writes.');
    console.log('    New calls will write now that HOT_TABLES_EOD_ONLY=false is deployed.');
    pool.end();
    return;
  }

  const stats = {};
  for (const call of allCalls) {
    const email = (call.owner_email || '').toLowerCase().trim();
    if (!email || !email.includes('@')) continue;
    if (!stats[email]) stats[email] = { dials: 0, reached: 0 };
    stats[email].dials++;
    if (Number(call.call_duration || 0) >= 50) stats[email].reached++;
  }

  console.log(`👥 Unique agents: ${Object.keys(stats).length}`);

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

  console.log(`✅ Upserted ${upserted} agents`);

  const { rows } = await pool.query(`
    SELECT agent_email, dials, reached, booked
    FROM agent_daily_stats WHERE stat_date = $1::date
    ORDER BY dials DESC LIMIT 20
  `, [TODAY_PT]);

  console.log(`\nTop 20 (${TODAY_PT}):`);
  rows.forEach(r => console.log(`  ${r.agent_email}: D=${r.dials} R=${r.reached} B=${r.booked}`));
  pool.end();
}

run().catch(e => { console.error('Fatal:', e.message); pool.end(); process.exit(1); });
