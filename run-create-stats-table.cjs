const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({ connectionString: 'postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require' });
const sql = fs.readFileSync('create-agent-daily-stats.sql', 'utf8');
pool.query(sql)
  .then(() => { console.log('✅ agent_daily_stats table created'); })
  .catch(e => { console.error('❌', e.message); })
  .finally(() => pool.end());
