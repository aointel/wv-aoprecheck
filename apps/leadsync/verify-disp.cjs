const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require', max:2, connectionTimeoutMillis:8000 });
async function main() {
  // Check the lead we just dispositioned
  const { rows: lead } = await pool.query("SELECT id, taalk_lead_id, phone, cn_email, cnresolution, updated_at FROM masterlead WHERE taalk_lead_id='20010097'");
  console.log('Lead after disposition:', JSON.stringify(lead[0]));

  // Check pending count for coxsteven
  const { rows: cnt } = await pool.query("SELECT COUNT(*)::int AS cnt FROM masterlead WHERE cn_email='coxsteven@aoglobelife.com' AND LOWER(COALESCE(cnresolution,'')) = 'pending' AND LOWER(COALESCE(taalk_market,'')) NOT IN ('plus lead','plus leads') AND COALESCE(dnc::text,'false') NOT IN ('true','1') AND COALESCE(\"TaalkResolve\"::text,'') NOT IN ('true','1')");
  console.log('Leadsync pending count:', cnt[0].cnt);
  await pool.end();
}
main().catch(e => { console.error(e.message); pool.end(); });
