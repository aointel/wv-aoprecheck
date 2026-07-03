const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require', max: 2, connectionTimeoutMillis: 10000 });
pool.query("SELECT id, cn_email, cnresolution, phone FROM masterlead WHERE phone LIKE '%6304455291%' LIMIT 1")
  .then(r => { console.log('NEON after disposition:', JSON.stringify(r.rows[0])); pool.end(); })
  .catch(e => { console.error('NEON err:', e.message); pool.end(); });
