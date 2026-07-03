const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function run() {
  const minutes = Math.max(1, Number(process.argv[2] || 20) || 20);
  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });
  await client.connect();
  try {
    const rows = await client.query(
      `
        WITH repeat_phones AS (
          SELECT
            RIGHT(REGEXP_REPLACE(COALESCE(to_number, ''), '\\D', '', 'g'), 10) AS phone10
          FROM twilio_call_logs
          WHERE lower(COALESCE(call_direction, '')) LIKE 'outbound%'
            AND lower(COALESCE(call_status, '')) = 'failed'
            AND call_started_at >= NOW() - ($1::int * INTERVAL '1 minute')
            AND length(RIGHT(REGEXP_REPLACE(COALESCE(to_number, ''), '\\D', '', 'g'), 10)) = 10
          GROUP BY 1
          HAVING COUNT(*) >= 2
        )
        SELECT
          RIGHT(REGEXP_REPLACE(COALESCE(t.to_number, ''), '\\D', '', 'g'), 10) AS phone10,
          lower(COALESCE(t.owner_email, '')) AS owner_email,
          COUNT(*)::int AS failed_rows,
          COUNT(DISTINCT COALESCE(NULLIF(t.parent_call_sid, ''), t.twilio_call_sid))::int AS failed_groups,
          MAX(t.call_started_at) AS last_failed_at
        FROM twilio_call_logs t
        JOIN repeat_phones rp
          ON rp.phone10 = RIGHT(REGEXP_REPLACE(COALESCE(t.to_number, ''), '\\D', '', 'g'), 10)
        WHERE lower(COALESCE(t.call_direction, '')) LIKE 'outbound%'
          AND lower(COALESCE(t.call_status, '')) = 'failed'
          AND t.call_started_at >= NOW() - ($1::int * INTERVAL '1 minute')
        GROUP BY 1, 2
        ORDER BY phone10, failed_rows DESC, owner_email
      `,
      [minutes],
    );

    console.log(
      JSON.stringify(
        {
          window_minutes: minutes,
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
