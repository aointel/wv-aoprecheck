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
    const timing = await client.query(
      `
      WITH base AS MATERIALIZED (
        SELECT ml.created_at AT TIME ZONE $1 AS local_created_at, ml.created_at
        FROM masterlead ml
        WHERE (ml.created_at AT TIME ZONE $1)::date = (NOW() AT TIME ZONE $1)::date
          AND lower(
            COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), '')
          ) LIKE '%globe%'
      )
      SELECT
        metric,
        key,
        value
      FROM (
        SELECT
          'summary'::text AS metric,
          'total_today'::text AS key,
          COUNT(*)::text AS value
        FROM base
        UNION ALL
        SELECT 'summary', 'first_created_at_utc', COALESCE(MIN(created_at)::text, '')
        FROM base
        UNION ALL
        SELECT 'summary', 'last_created_at_utc', COALESCE(MAX(created_at)::text, '')
        FROM base
        UNION ALL
        SELECT
          'hourly'::text,
          to_char(date_trunc('hour', local_created_at), 'YYYY-MM-DD HH24:00') AS key,
          COUNT(*)::text AS value
        FROM base
        GROUP BY 2
        UNION ALL
        SELECT
          'minute'::text,
          to_char(date_trunc('minute', local_created_at), 'YYYY-MM-DD HH24:MI') AS key,
          COUNT(*)::text AS value
        FROM base
        GROUP BY 2
      ) x
      ORDER BY metric ASC, key ASC
      `,
      [tz],
    );
    const summary = {};
    const hourly = [];
    const minuteRows = [];
    for (const row of timing.rows) {
      if (row.metric === "summary") {
        summary[row.key] = row.value;
      } else if (row.metric === "hourly") {
        hourly.push({
          local_hour: row.key,
          lead_count: Number(row.value || 0),
        });
      } else if (row.metric === "minute") {
        minuteRows.push({
          local_minute: row.key,
          lead_count: Number(row.value || 0),
        });
      }
    }

    console.log(
      JSON.stringify(
        {
          timezone: tz,
          summary,
          hourly: hourly.sort((a, b) => (a.local_hour < b.local_hour ? -1 : 1)),
          top_minute_bursts: minuteRows
            .sort((a, b) => b.lead_count - a.lead_count || (a.local_minute < b.local_minute ? -1 : 1))
            .slice(0, 25),
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
