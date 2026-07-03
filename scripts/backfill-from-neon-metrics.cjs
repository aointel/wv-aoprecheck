const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }, max: 5
});

const TODAY_PT = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });

async function run() {
  // How many rows total in agent_dial_metrics today?
  const countRes = await pool.query(`
    SELECT COUNT(*) AS total, MIN(event_timestamp) AS earliest, MAX(event_timestamp) AS latest
    FROM agent_dial_metrics
    WHERE event_timestamp >= $1::date
      AND event_timestamp <  $1::date + INTERVAL '1 day'
  `, [TODAY_PT]);
  console.log(`\nagent_dial_metrics today (${TODAY_PT}):`);
  console.log(`  Total rows: ${countRes.rows[0].total}`);
  console.log(`  Earliest:   ${countRes.rows[0].earliest}`);
  console.log(`  Latest:     ${countRes.rows[0].latest}`);

  // Breakdown by event_type
  const typeRes = await pool.query(`
    SELECT event_type, COUNT(*) AS cnt
    FROM agent_dial_metrics
    WHERE event_timestamp >= $1::date
      AND event_timestamp <  $1::date + INTERVAL '1 day'
    GROUP BY event_type ORDER BY cnt DESC
  `, [TODAY_PT]);
  console.log('\n  By event_type:');
  typeRes.rows.forEach(r => console.log(`    ${r.event_type}: ${r.cnt}`));

  // Now backfill agent_daily_stats from it
  const result = await pool.query(`
    INSERT INTO agent_daily_stats (agent_email, stat_date, dials, reached, booked, updated_at)
    SELECT
      LOWER(TRIM(agent_email)),
      $1::date,
      COUNT(*) FILTER (WHERE LOWER(event_type) = 'dial'),
      COUNT(*) FILTER (WHERE LOWER(event_type) = 'reach'),
      COUNT(*) FILTER (WHERE LOWER(event_type) = 'booked'),
      NOW()
    FROM agent_dial_metrics
    WHERE event_timestamp >= $1::date
      AND event_timestamp <  $1::date + INTERVAL '1 day'
      AND agent_email IS NOT NULL AND agent_email != ''
      AND LOWER(event_type) IN ('dial','reach','booked')
    GROUP BY LOWER(TRIM(agent_email))
    ON CONFLICT (agent_email, stat_date)
    DO UPDATE SET
      dials      = GREATEST(agent_daily_stats.dials,   EXCLUDED.dials),
      reached    = GREATEST(agent_daily_stats.reached, EXCLUDED.reached),
      booked     = GREATEST(agent_daily_stats.booked,  EXCLUDED.booked),
      updated_at = NOW()
  `, [TODAY_PT]);

  console.log(`\n✅ Upserted ${result.rowCount} agents into agent_daily_stats`);

  const { rows } = await pool.query(`
    SELECT agent_email, dials, reached, booked
    FROM agent_daily_stats WHERE stat_date = $1::date
    ORDER BY dials DESC LIMIT 20
  `, [TODAY_PT]);

  console.log(`\nTop 20 after backfill:`);
  rows.forEach(r => console.log(`  ${r.agent_email}: D=${r.dials} R=${r.reached} B=${r.booked}`));
  pool.end();
}

run().catch(e => { console.error(e.message); pool.end(); });
