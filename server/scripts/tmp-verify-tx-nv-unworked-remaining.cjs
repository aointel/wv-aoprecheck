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
    const q = await client.query(`
      SELECT
        UPPER(COALESCE(NULLIF(TRIM(state), ''), '??')) AS state,
        COUNT(*)::int AS rows
      FROM masterlead
      WHERE UPPER(COALESCE(NULLIF(TRIM(state), ''), '??')) IN ('TX', 'NV')
        AND (
          cnresolution IS NULL
          OR LOWER(TRIM(cnresolution)) IN ('pending', 'called', 'no answer')
        )
      GROUP BY 1
      ORDER BY 1
    `);
    console.log(JSON.stringify(q.rows, null, 2));
  } finally {
    await client.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

