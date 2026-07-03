const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function run() {
  const tz = String(process.argv[2] || "America/Los_Angeles");
  const days = Number(process.argv[3] || 5);

  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });
  await client.connect();
  try {
    const result = await client.query(
      `
      WITH base AS (
        SELECT
          (ml.created_at AT TIME ZONE $1)::date AS local_date,
          upper(
            COALESCE(
              NULLIF(btrim(ml.taalk_state::text), ''),
              NULLIF(btrim(ml.state::text), ''),
              'UNKNOWN'
            )
          ) AS state
        FROM masterlead ml
        WHERE (ml.created_at AT TIME ZONE $1)::date >= ((NOW() AT TIME ZONE $1)::date - ($2::int - 1))
          AND lower(
            COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), '')
          ) LIKE '%globe%'
      ),
      grouped AS (
        SELECT
          to_char(local_date, 'YYYY-MM-DD') AS local_date,
          state,
          COUNT(*)::int AS lead_count
        FROM base
        GROUP BY local_date, state
      )
      SELECT
        local_date,
        SUM(lead_count)::int AS total,
        json_agg(
          json_build_object('state', state, 'count', lead_count)
          ORDER BY lead_count DESC, state ASC
        ) AS states
      FROM grouped
      GROUP BY local_date
      ORDER BY local_date DESC
      `,
      [tz, days],
    );

    console.log(JSON.stringify({ timezone: tz, days, rows: result.rows }, null, 2));
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
