const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
pool.query(`SELECT agent_email, dials, reached, booked FROM agent_daily_stats WHERE stat_date = $1::date ORDER BY dials DESC LIMIT 20`, [today])
  .then(r => { console.log(`Today (${today}):`); r.rows.forEach(row => console.log(`  ${row.agent_email}: dials=${row.dials} reached=${row.reached} booked=${row.booked}`)); pool.end(); })
  .catch(e => { console.error(e.message); pool.end(); });
