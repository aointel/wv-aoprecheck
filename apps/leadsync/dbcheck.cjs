const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require' });
async function main() {
  const r1 = await pool.query("SELECT COUNT(*) as cnt FROM masterlead WHERE cn_email = 'chrislafond@aoglobelife.com' AND cnresolution = 'pending'");
  console.log('pending for chris:', r1.rows[0].cnt);
  const r2 = await pool.query("SELECT COUNT(*) as cnt FROM masterlead WHERE cn_email IS NULL");
  console.log('unassigned total:', r2.rows[0].cnt);
  const r3 = await pool.query("SELECT COUNT(*) as cnt FROM masterlead");
  console.log('total rows:', r3.rows[0].cnt);
  await pool.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
