const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require' });
async function main() {
  // Check customers table for chris
  const r = await pool.query("SELECT company_email, personal_email, associate_id FROM customers WHERE company_email ILIKE '%lafond%' OR personal_email ILIKE '%lafond%' LIMIT 3");
  console.log('customers:', JSON.stringify(r.rows));
  // Check what the leads query would use
  const r2 = await pool.query("SELECT COUNT(*) as cnt FROM masterlead WHERE cn_email ILIKE '%lafond%' AND cnresolution = 'pending'");
  console.log('pending leads for lafond pattern:', r2.rows[0].cnt);
  await pool.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
