const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require', max:2, connectionTimeoutMillis:8000 });
async function main() {
  // Exact query the dialer cache runs
  const { rows } = await pool.query(`
    SELECT id, first_name, last_name, phone, state, cnresolution, cn_email, taalk_lead_id, updated_at
    FROM masterlead
    WHERE cn_email = 'coxsteven@aoglobelife.com'
      AND (cnresolution = 'pending' OR cnresolution IS NULL)
    ORDER BY updated_at DESC
    LIMIT 10
  `);
  console.log('Dialer cache query result - count:', rows.length);
  console.log('Sample:', JSON.stringify(rows.slice(0,3), null, 2));
  await pool.end();
}
main().catch(e => { console.error(e.message); pool.end(); });
