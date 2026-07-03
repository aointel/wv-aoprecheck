const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require' });

async function main() {
  // Check agent_daily_stats
  console.log('\n=== agent_daily_stats (today) ===');
  const { rows: stats } = await pool.query(
    `SELECT agent_email, stat_date, dials, reached, booked, updated_at
     FROM agent_daily_stats
     WHERE stat_date = CURRENT_DATE
     ORDER BY dials DESC LIMIT 20`
  );
  if (stats.length === 0) console.log('  EMPTY - nothing written today');
  else stats.forEach(r => console.log(`  ${r.agent_email}: D=${r.dials} R=${r.reached} B=${r.booked} updated=${r.updated_at}`));

  // Check agent_dial_metrics today
  console.log('\n=== agent_dial_metrics (today) ===');
  const { rows: metrics } = await pool.query(
    `SELECT agent_email, event_type, COUNT(*) as cnt
     FROM agent_dial_metrics
     WHERE event_timestamp >= CURRENT_DATE
     GROUP BY agent_email, event_type
     ORDER BY agent_email, event_type
     LIMIT 30`
  );
  if (metrics.length === 0) console.log('  EMPTY - no events today');
  else metrics.forEach(r => console.log(`  ${r.agent_email}: ${r.event_type} x${r.cnt}`));

  // Check most recent entries in agent_dial_metrics
  console.log('\n=== Most recent agent_dial_metrics entries ===');
  const { rows: recent } = await pool.query(
    `SELECT agent_email, event_type, disposition, call_duration, event_timestamp
     FROM agent_dial_metrics
     ORDER BY event_timestamp DESC LIMIT 10`
  );
  if (recent.length === 0) console.log('  EMPTY - table has no data');
  else recent.forEach(r => console.log(`  ${r.event_timestamp?.toISOString().slice(0,19)} | ${r.agent_email} | ${r.event_type} | ${r.disposition} | ${r.call_duration}s`));
}

main().catch(console.error).finally(() => pool.end());
