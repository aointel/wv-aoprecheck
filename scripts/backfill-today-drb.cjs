/**
 * Backfills today's D/R/B into agent_daily_stats from agent_dial_metrics on Neon.
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false },
  max: 5
});

const TODAY_PT = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });

console.log(`\n📅 Backfilling agent_daily_stats for ${TODAY_PT} from agent_dial_metrics (Neon)\n`);

async function run() {
  // Check what columns exist in agent_dial_metrics
  const cols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'agent_dial_metrics' ORDER BY column_name`);
  console.log('agent_dial_metrics columns:', cols.rows.map(r => r.column_name).join(', '));

  // Aggregate today's DRB from agent_dial_metrics, use GREATEST to not overwrite better values
  const result = await pool.query(`
    INSERT INTO agent_daily_stats (agent_email, stat_date, dials, reached, booked, updated_at)
    SELECT
      LOWER(TRIM(agent_email)) AS agent_email,
      $1::date AS stat_date,
      COUNT(*) FILTER (WHERE LOWER(event_type) = 'dial')   AS dials,
      COUNT(*) FILTER (WHERE LOWER(event_type) = 'reach')  AS reached,
      COUNT(*) FILTER (WHERE LOWER(event_type) = 'booked') AS booked,
      NOW() AS updated_at
    FROM agent_dial_metrics
    WHERE event_timestamp >= $1::date
      AND event_timestamp <  $1::date + INTERVAL '1 day'
      AND agent_email IS NOT NULL
      AND agent_email != ''
      AND LOWER(event_type) IN ('dial', 'reach', 'booked')
    GROUP BY LOWER(TRIM(agent_email))
    ON CONFLICT (agent_email, stat_date)
    DO UPDATE SET
      dials      = GREATEST(agent_daily_stats.dials,   EXCLUDED.dials),
      reached    = GREATEST(agent_daily_stats.reached, EXCLUDED.reached),
      booked     = GREATEST(agent_daily_stats.booked,  EXCLUDED.booked),
      updated_at = NOW()
  `, [TODAY_PT]);

  console.log(`✅ Upserted rows: ${result.rowCount}`);

  // Show top 15 after backfill
  const { rows } = await pool.query(`
    SELECT agent_email, dials, reached, booked
    FROM agent_daily_stats WHERE stat_date = $1::date
    ORDER BY dials DESC LIMIT 15
  `, [TODAY_PT]);

  console.log(`\nTop 15 after backfill:`);
  rows.forEach(r => console.log(`  ${r.agent_email}: D=${r.dials} R=${r.reached} B=${r.booked}`));

  pool.end();
}

run().catch(e => { console.error(e.message); pool.end(); });
