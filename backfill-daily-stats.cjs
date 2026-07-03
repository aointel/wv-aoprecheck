const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require' });

async function main() {
  const { rowCount } = await pool.query(`
    INSERT INTO agent_daily_stats (agent_email, stat_date, dials, reached, booked)
    SELECT
      agent_email,
      event_timestamp::date AS stat_date,
      COUNT(*) FILTER (WHERE event_type = 'dial')   AS dials,
      COUNT(*) FILTER (WHERE event_type = 'reach')  AS reached,
      COUNT(*) FILTER (WHERE event_type = 'booked') AS booked
    FROM agent_dial_metrics
    WHERE event_timestamp >= CURRENT_DATE
    GROUP BY agent_email, event_timestamp::date
    ON CONFLICT (agent_email, stat_date)
    DO UPDATE SET
      dials   = EXCLUDED.dials,
      reached = EXCLUDED.reached,
      booked  = EXCLUDED.booked,
      updated_at = NOW()
  `);
  console.log('Backfilled:', rowCount, 'rows into agent_daily_stats');

  // Show result
  const { rows } = await pool.query(
    `SELECT agent_email, dials, reached, booked FROM agent_daily_stats WHERE stat_date = CURRENT_DATE ORDER BY dials DESC`
  );
  rows.forEach(r => console.log(`  ${r.agent_email}: D=${r.dials} R=${r.reached} B=${r.booked}`));
}

main().catch(console.error).finally(() => pool.end());
