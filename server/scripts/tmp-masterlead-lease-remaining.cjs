const { Client } = require('pg');

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require';

async function run() {
  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });
  await client.connect();
  try {
    const q = `
      SELECT id, taalk_lead_id, cn_email, previous_cn_email, cnresolution, updated_at
      FROM masterlead
      WHERE (cnresolution IS NULL OR LOWER(TRIM(cnresolution)) IN ('called','pending','no answer'))
        AND COALESCE(NULLIF(TRIM(cn_email),''),NULL) IS NOT NULL
        AND COALESCE(NULLIF(TRIM(previous_cn_email),''),NULL) IS NOT NULL
      ORDER BY updated_at DESC NULLS LAST, id DESC
      LIMIT 50
    `;
    const r = await client.query(q);
    console.log(JSON.stringify({ remaining: r.rows.length, rows: r.rows }, null, 2));
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

