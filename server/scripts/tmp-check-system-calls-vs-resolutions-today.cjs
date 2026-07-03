const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function run() {
  const day = String(process.argv[2] || "2026-05-15").trim();
  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });
  await client.connect();
  try {
    const counts = await client.query(
      `
        WITH w AS (
          SELECT
            ((($1::date)::timestamp AT TIME ZONE 'America/New_York') + interval '6 hours') AS start_utc,
            ((((($1::date + 1))::timestamp AT TIME ZONE 'America/New_York') + interval '6 hours')) AS end_utc
        ),
        calls AS (
          SELECT
            COUNT(*)::int AS outbound_call_rows,
            COUNT(DISTINCT twilio_call_sid)::int AS distinct_outbound_call_sids,
            COUNT(DISTINCT COALESCE(NULLIF(parent_call_sid, ''), twilio_call_sid))::int AS distinct_outbound_call_groups
          FROM twilio_call_logs t
          CROSS JOIN w
          WHERE lower(COALESCE(t.call_direction, '')) LIKE 'outbound%'
            AND t.call_started_at >= w.start_utc
            AND t.call_started_at < w.end_utc
        ),
        resolutions AS (
          SELECT
            COUNT(*)::int AS non_pending_masterlead_updates
          FROM masterlead ml
          CROSS JOIN w
          WHERE ml.updated_at >= w.start_utc
            AND ml.updated_at < w.end_utc
            AND lower(trim(COALESCE(ml.cnresolution, 'pending'))) NOT IN ('pending', 'new', '', 'null')
        )
        SELECT
          (SELECT outbound_call_rows FROM calls) AS outbound_call_rows,
          (SELECT distinct_outbound_call_sids FROM calls) AS distinct_outbound_call_sids,
          (SELECT distinct_outbound_call_groups FROM calls) AS distinct_outbound_call_groups,
          (SELECT non_pending_masterlead_updates FROM resolutions) AS non_pending_masterlead_updates
      `,
      [day],
    );

    console.log(
      JSON.stringify(
        {
          day,
          metrics: counts.rows[0] || {},
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
