const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function run() {
  const tz = String(process.argv[2] || "America/Los_Angeles");
  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });
  await client.connect();
  try {
    const rows = await client.query(
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
          WHERE ml.created_at >= NOW() - INTERVAL '3 days'
            AND lower(
              regexp_replace(
                COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), ''),
                '\\s+',
                '',
                'g'
              )
            ) LIKE '%globe%'
        ),
        days AS (
          SELECT (NOW() AT TIME ZONE $1)::date AS today_local,
                 ((NOW() AT TIME ZONE $1)::date - 1) AS yesterday_local
        )
        SELECT
          CASE
            WHEN b.local_date = d.today_local THEN 'today'
            WHEN b.local_date = d.yesterday_local THEN 'yesterday'
            ELSE 'other'
          END AS bucket,
          b.local_date,
          b.state,
          COUNT(*)::int AS lead_count
        FROM base b
        CROSS JOIN days d
        WHERE b.local_date IN (d.today_local, d.yesterday_local)
        GROUP BY bucket, b.local_date, b.state
        ORDER BY b.local_date DESC, lead_count DESC, b.state ASC
      `,
      [tz],
    );

    const totals = rows.rows.reduce(
      (acc, r) => {
        if (r.bucket === "today") acc.today += Number(r.lead_count || 0);
        if (r.bucket === "yesterday") acc.yesterday += Number(r.lead_count || 0);
        return acc;
      },
      { today: 0, yesterday: 0 },
    );

    console.log(
      JSON.stringify(
        {
          timezone: tz,
          totals,
          rows: rows.rows,
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
