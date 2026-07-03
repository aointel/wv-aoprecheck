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
    const daily = await client.query(`
      SELECT
        (created_at AT TIME ZONE 'America/New_York')::date AS day_et,
        COUNT(*)::int AS leads
      FROM masterlead
      WHERE (
        LOWER(COALESCE(taalk_market, '')) LIKE '%globe%'
        OR LOWER(COALESCE(market, '')) LIKE '%globe%'
      )
        AND (created_at AT TIME ZONE 'America/New_York')::date BETWEEN DATE '2026-05-01' AND DATE '2026-05-03'
      GROUP BY 1
      ORDER BY 1;
    `);

    const byState = await client.query(`
      SELECT
        (created_at AT TIME ZONE 'America/New_York')::date AS day_et,
        UPPER(COALESCE(NULLIF(TRIM(state), ''), '??')) AS state,
        COUNT(*)::int AS leads
      FROM masterlead
      WHERE (
        LOWER(COALESCE(taalk_market, '')) LIKE '%globe%'
        OR LOWER(COALESCE(market, '')) LIKE '%globe%'
      )
        AND (created_at AT TIME ZONE 'America/New_York')::date BETWEEN DATE '2026-05-01' AND DATE '2026-05-03'
      GROUP BY 1, 2
      ORDER BY 1, 3 DESC;
    `);

    console.log(JSON.stringify({ daily: daily.rows, by_state: byState.rows }, null, 2));
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

