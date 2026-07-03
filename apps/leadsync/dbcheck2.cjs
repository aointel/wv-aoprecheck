const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require' });
async function main() {
  const r = await pool.query("SELECT id, cn_email, cnresolution, taalk_market, associate_id FROM masterlead WHERE cn_email = 'chrislafond@aoglobelife.com' AND cnresolution = 'pending' LIMIT 5");
  r.rows.forEach(row => console.log(JSON.stringify(row)));
  await pool.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
