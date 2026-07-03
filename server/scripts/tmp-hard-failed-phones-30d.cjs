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
        AND lower(COALESCE(call_status, '')) = 'failed'
        AND call_started_at >= NOW() - INTERVAL '30 days'
        AND length(RIGHT(REGEXP_REPLACE(COALESCE(to_number, ''), '\\D', '', 'g'), 10)) = 10
    `);

    const stillPending = await client.query(`
      SELECT COUNT(DISTINCT ml.id)::int AS failed_phones_still_pending
      FROM masterlead ml
      WHERE EXISTS (
        SELECT 1
        FROM twilio_call_logs t
        WHERE lower(COALESCE(t.call_direction, '')) LIKE 'outbound%'
          AND lower(COALESCE(t.call_status, '')) = 'failed'
          AND t.call_started_at >= NOW() - INTERVAL '30 days'
          AND RIGHT(REGEXP_REPLACE(COALESCE(t.to_number, ''), '\\D', '', 'g'), 10) =
              COALESCE(NULLIF(btrim(ml.phone_last10), ''), RIGHT(REGEXP_REPLACE(COALESCE(ml.phone::text, ''), '\\D', '', 'g'), 10))
      )
      AND lower(trim(COALESCE(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
    `);

    console.log(JSON.stringify({
      hard_failed_only_30d: summary.rows[0] || {},
      still_pending_in_masterlead: stillPending.rows[0]?.failed_phones_still_pending || 0,
    }, null, 2));
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
