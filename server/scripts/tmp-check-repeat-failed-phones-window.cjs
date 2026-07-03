const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function run() {
  const minutes = Math.max(1, Number(process.argv[2] || 20) || 20);
  const topN = Math.max(1, Number(process.argv[3] || 30) || 30);
  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });
  await client.connect();
  try {
    const summary = await client.query(
      `
        WITH failed AS (
          SELECT
            RIGHT(REGEXP_REPLACE(COALESCE(to_number, ''), '\\D', '', 'g'), 10) AS phone10,
            COALESCE(NULLIF(parent_call_sid, ''), twilio_call_sid) AS call_group_sid
          FROM twilio_call_logs
          WHERE lower(COALESCE(call_direction, '')) LIKE 'outbound%'
            AND lower(COALESCE(call_status, '')) = 'failed'
            AND call_started_at >= NOW() - ($1::int * INTERVAL '1 minute')
            AND length(RIGHT(REGEXP_REPLACE(COALESCE(to_number, ''), '\\D', '', 'g'), 10)) = 10
        )
        SELECT
          COUNT(*)::int AS failed_rows,
          COUNT(DISTINCT call_group_sid)::int AS failed_groups,
          COUNT(DISTINCT phone10)::int AS failed_distinct_phones,
          COUNT(*) FILTER (
            WHERE phone10 IN (SELECT phone10 FROM failed GROUP BY phone10 HAVING COUNT(*) >= 2)
          )::int AS failed_rows_on_repeat_phones,
          COUNT(DISTINCT phone10) FILTER (
            WHERE phone10 IN (SELECT phone10 FROM failed GROUP BY phone10 HAVING COUNT(*) >= 2)
          )::int AS repeat_failed_phones
        FROM failed
      `,
      [minutes],
    );

    const repeats = await client.query(
      `
        SELECT
          RIGHT(REGEXP_REPLACE(COALESCE(to_number, ''), '\\D', '', 'g'), 10) AS phone10,
          COUNT(*)::int AS failed_rows,
          COUNT(DISTINCT COALESCE(NULLIF(parent_call_sid, ''), twilio_call_sid))::int AS failed_groups,
          MAX(call_started_at) AS last_failed_at
        FROM twilio_call_logs
        WHERE lower(COALESCE(call_direction, '')) LIKE 'outbound%'
          AND lower(COALESCE(call_status, '')) = 'failed'
          AND call_started_at >= NOW() - ($1::int * INTERVAL '1 minute')
          AND length(RIGHT(REGEXP_REPLACE(COALESCE(to_number, ''), '\\D', '', 'g'), 10)) = 10
        GROUP BY 1
        HAVING COUNT(*) >= 2
        ORDER BY failed_rows DESC, last_failed_at DESC
        LIMIT $2
      `,
      [minutes, topN],
    );

    console.log(
      JSON.stringify(
        {
          window_minutes: minutes,
          summary: summary.rows[0] || {},
          repeat_failed_phones: repeats.rows,
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
