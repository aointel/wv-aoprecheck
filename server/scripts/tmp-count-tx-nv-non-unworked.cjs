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
      WITH base AS (
        SELECT
          UPPER(COALESCE(NULLIF(TRIM(state), ''), '??')) AS state,
          LOWER(COALESCE(NULLIF(TRIM(cnresolution), ''), 'null')) AS cnresolution_norm
        FROM masterlead
        WHERE (
          LOWER(COALESCE(taalk_market, '')) LIKE '%globe%'
          OR LOWER(COALESCE(market, '')) LIKE '%globe%'
        )
          AND (created_at AT TIME ZONE 'America/New_York')::date = DATE '2026-05-01'
          AND UPPER(COALESCE(NULLIF(TRIM(state), ''), '??')) IN ('TX', 'NV')
      )
      SELECT
        state,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (
          WHERE cnresolution_norm IN ('null', 'pending', 'called', 'no answer')
        )::int AS unworked,
        COUNT(*) FILTER (
          WHERE cnresolution_norm NOT IN ('null', 'pending', 'called', 'no answer')
        )::int AS non_unworked
      FROM base
      GROUP BY state
      ORDER BY state;
    `);

    const rows = q.rows || [];
    const totals = rows.reduce(
      (acc, r) => ({
        total: acc.total + Number(r.total || 0),
        unworked: acc.unworked + Number(r.unworked || 0),
        non_unworked: acc.non_unworked + Number(r.non_unworked || 0),
      }),
      { total: 0, unworked: 0, non_unworked: 0 },
    );

    console.log(JSON.stringify({ day_et: '2026-05-01', rows, totals }, null, 2));
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

