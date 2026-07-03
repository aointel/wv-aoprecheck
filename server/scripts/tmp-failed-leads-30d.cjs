const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function run() {
  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });
  await client.connect();
  try {
    const summary = await client.query(`
      SELECT
        COUNT(DISTINCT RIGHT(REGEXP_REPLACE(COALESCE(to_number, ''), '\\D', '', 'g'), 10))::int AS distinct_failed_phones,
        COUNT(DISTINCT twilio_call_sid)::int AS total_failed_call_sids
      FROM twilio_call_logs
      WHERE lower(COALESCE(call_direction, '')) LIKE 'outbound%'
        AND lower(COALESCE(call_status, '')) IN ('failed', 'no-answer', 'no_answer', 'busy')
        AND call_started_at >= NOW() - INTERVAL '30 days'
        AND length(RIGHT(REGEXP_REPLACE(COALESCE(to_number, ''), '\\D', '', 'g'), 10)) = 10
    `);

    const top = await client.query(`
      SELECT
        RIGHT(REGEXP_REPLACE(COALESCE(to_number, ''), '\\D', '', 'g'), 10) AS phone10,
        COUNT(DISTINCT twilio_call_sid)::int AS total_attempts,
        COUNT(DISTINCT twilio_call_sid) FILTER (
          WHERE lower(COALESCE(call_status, '')) IN ('failed', 'no-answer', 'no_answer', 'busy')
        )::int AS failed_attempts,
        COUNT(DISTINCT twilio_call_sid) FILTER (
          WHERE lower(COALESCE(call_status, '')) = 'failed'
        )::int AS hard_failed,
        MIN(call_started_at) AS first_call,
        MAX(call_started_at) AS last_call
      FROM twilio_call_logs
      WHERE lower(COALESCE(call_direction, '')) LIKE 'outbound%'
        AND call_started_at >= NOW() - INTERVAL '30 days'
        AND length(RIGHT(REGEXP_REPLACE(COALESCE(to_number, ''), '\\D', '', 'g'), 10)) = 10
      GROUP BY 1
      HAVING COUNT(DISTINCT twilio_call_sid) FILTER (
        WHERE lower(COALESCE(call_status, '')) IN ('failed', 'no-answer', 'no_answer', 'busy')
      ) >= 3
      ORDER BY failed_attempts DESC, total_attempts DESC
      LIMIT 50
    `);

    const stillInMasterlead = await client.query(`
      SELECT COUNT(DISTINCT ml.id)::int AS failed_phones_still_in_masterlead
      FROM masterlead ml
      WHERE EXISTS (
        SELECT 1
        FROM twilio_call_logs t
        WHERE lower(COALESCE(t.call_direction, '')) LIKE 'outbound%'
          AND lower(COALESCE(t.call_status, '')) IN ('failed', 'no-answer', 'no_answer', 'busy')
          AND t.call_started_at >= NOW() - INTERVAL '30 days'
          AND RIGHT(REGEXP_REPLACE(COALESCE(t.to_number, ''), '\\D', '', 'g'), 10) =
              COALESCE(NULLIF(btrim(ml.phone_last10), ''), RIGHT(REGEXP_REPLACE(COALESCE(ml.phone::text, ''), '\\D', '', 'g'), 10))
      )
      AND lower(trim(COALESCE(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
    `);

    console.log(JSON.stringify({
      summary_30d: summary.rows[0] || {},
      failed_phones_still_pending_in_masterlead: stillInMasterlead.rows[0]?.failed_phones_still_in_masterlead || 0,
      top_repeat_failure_phones: top.rows,
    }, null, 2));
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
