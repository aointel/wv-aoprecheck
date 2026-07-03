const { Pool } = require('pg');
const DB = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require';
const pool = new Pool({ connectionString: DB, max: 3 });

async function main() {
  const client = await pool.connect();
  try {
    // Check current cap count exactly as leadsync does
    const { rows: cnt } = await client.query(`
      SELECT COUNT(*)::int AS cnt FROM masterlead
      WHERE cn_email = 'coxsteven@aoglobelife.com'
        AND LOWER(COALESCE(cnresolution,'')) = 'pending'
        AND LOWER(COALESCE(taalk_market,'')) NOT IN ('plus lead','plus leads')
        AND COALESCE(dnc::text,'false') NOT IN ('true','1')
        AND COALESCE("TaalkResolve"::text,'') NOT IN ('true','1')
    `);
    console.log('Leadsync count query result (current cap):', cnt[0].cnt);

    // Full breakdown
    const { rows: breakdown } = await client.query(`
      SELECT cnresolution, COUNT(*)::int AS cnt FROM masterlead
      WHERE cn_email = 'coxsteven@aoglobelife.com'
      GROUP BY 1 ORDER BY cnt DESC
    `);
    console.log('Full cnresolution breakdown:', JSON.stringify(breakdown));

    // Clear ALL terminal dispositions
    const { rowCount } = await client.query(`
      UPDATE masterlead SET cn_email = NULL, updated_at = NOW()
      WHERE cn_email = 'coxsteven@aoglobelife.com'
        AND cnresolution IN ('not_interested','wrong_number','dnc','already_been_sold')
    `);
    console.log('Cleared from Neon DB:', rowCount, 'rows');

    // Recheck
    const { rows: cnt2 } = await client.query(`
      SELECT COUNT(*)::int AS cnt FROM masterlead
      WHERE cn_email = 'coxsteven@aoglobelife.com'
        AND LOWER(COALESCE(cnresolution,'')) = 'pending'
        AND LOWER(COALESCE(taalk_market,'')) NOT IN ('plus lead','plus leads')
        AND COALESCE(dnc::text,'false') NOT IN ('true','1')
        AND COALESCE("TaalkResolve"::text,'') NOT IN ('true','1')
    `);
    console.log('New leadsync count after clear:', cnt2[0].cnt);
  } finally {
    client.release();
    await pool.end();
  }
}
main().catch(console.error);
