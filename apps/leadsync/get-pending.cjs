const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require', max:2, connectionTimeoutMillis:8000 });
pool.query("SELECT id, taalk_lead_id, phone, cn_email, cnresolution FROM masterlead WHERE cn_email='coxsteven@aoglobelife.com' AND cnresolution='pending' LIMIT 3")
  .then(r => { console.log(JSON.stringify(r.rows)); pool.end(); })
  .catch(e => { console.error(e.message); pool.end(); });
