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
      )
      SELECT
        to_char(local_date, 'YYYY-MM-DD') AS local_date,
        state,
        COUNT(*)::int AS lead_count
      FROM base
      GROUP BY local_date, state
      ORDER BY local_date DESC, lead_count DESC, state ASC
      `,
      [tz, days],
    );

    const totalsByDay = {};
    for (const row of result.rows) {
      totalsByDay[row.local_date] = (totalsByDay[row.local_date] || 0) + Number(row.lead_count || 0);
    }

    console.log(
      JSON.stringify(
        {
          timezone: tz,
          days,
          totals_by_day: totalsByDay,
          rows: result.rows,
        },
        null,
        2,
      ),
    );
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
