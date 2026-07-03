/**
 * Fixes reached counts — overwrites the bad Twilio-duration-based reached 
 * with the real reached counts from agent_dial_metrics (event_type='reach')
 * then sets reached = 0 for agents who have no reach events (Twilio numbers were wrong)
 */
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }, max: 5
});

const TODAY_PT = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });

async function run() {
  // Get real reach counts from agent_dial_metrics
  const { rows: reachRows } = await pool.query(`
    SELECT LOWER(TRIM(agent_email)) AS email, COUNT(*) AS reached
    FROM agent_dial_metrics
    WHERE event_timestamp >= $1::date
      AND event_timestamp <  $1::date + INTERVAL '1 day'
      AND LOWER(event_type) = 'reach'
      AND agent_email IS NOT NULL AND agent_email != ''
    GROUP BY LOWER(TRIM(agent_email))
  `, [TODAY_PT]);

  console.log(`Found ${reachRows.length} agents with reach events in agent_dial_metrics`);

  // First zero out ALL reached counts for today (Twilio duration was wrong)
  await pool.query(`
    UPDATE agent_daily_stats SET reached = 0, updated_at = NOW()
    WHERE stat_date = $1::date
  `, [TODAY_PT]);
  console.log('Reset all reached to 0');

  // Then set real values from agent_dial_metrics
  for (const row of reachRows) {
    await pool.query(`
      UPDATE agent_daily_stats SET reached = $1, updated_at = NOW()
      WHERE agent_email = $2 AND stat_date = $3::date
    `, [Number(row.reached), row.email, TODAY_PT]);
  }
  console.log(`Set real reached for ${reachRows.length} agents`);

  // Show top 20
  const { rows } = await pool.query(`
    SELECT agent_email, dials, reached, booked FROM agent_daily_stats
    WHERE stat_date = $1::date ORDER BY dials DESC LIMIT 20
  `, [TODAY_PT]);

  console.log(`\nFinal top 20 (${TODAY_PT}):`);
  rows.forEach(r => console.log(`  ${r.agent_email}: D=${r.dials} R=${r.reached} B=${r.booked}`));
  pool.end();
}
run().catch(e => { console.error(e.message); pool.end(); });
