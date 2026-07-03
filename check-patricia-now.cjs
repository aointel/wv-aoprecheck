const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require',
  connectionTimeoutMillis: 10000,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  // Check what columns actually exist
  const cols = await pool.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'masterlead' ORDER BY column_name
  `);
  console.log('Columns:', cols.rows.map(r => r.column_name).join(', '));

  // Now query Patricia
  const r = await pool.query(`
    SELECT id, phone, cn_email, cnresolution, taalk_lead_id, updated_at
    FROM masterlead
    WHERE id = 1107848 OR phone ILIKE '%9738551886%' OR taalk_lead_id IN ('20559825')
    ORDER BY id
    LIMIT 10
  `);
  console.log('\nPatricia rows:', JSON.stringify(r.rows, null, 2));
  pool.end();
}
run().catch(e => { console.error(e.message); pool.end(); });
