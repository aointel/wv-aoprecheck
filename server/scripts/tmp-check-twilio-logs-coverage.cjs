const { Client } = require('pg');

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require';

async function run() {
  const c = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });
  await c.connect();
  try {
    const q = await c.query(`
      SELECT
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(call_direction, '')) IN ('outbound','outbound-dial','outbound-api')
        )::int AS outbound_all_rows,
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(call_direction, '')) IN ('outbound','outbound-dial','outbound-api')
            AND call_started_at IS NULL
        )::int AS outbound_missing_started_at,
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(call_direction, '')) IN ('outbound','outbound-dial','outbound-api')
            AND call_started_at >= (((CURRENT_DATE)::timestamp AT TIME ZONE 'America/New_York') + interval '6 hours')
            AND call_started_at < ((((CURRENT_DATE + 1))::timestamp AT TIME ZONE 'America/New_York') + interval '6 hours')
        )::int AS outbound_in_operational_window
        ,
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(call_direction, '')) IN ('outbound','outbound-dial','outbound-api')
            AND call_started_at >= (((CURRENT_DATE)::timestamp AT TIME ZONE 'America/New_York') + interval '6 hours')
            AND call_started_at < ((((CURRENT_DATE + 1))::timestamp AT TIME ZONE 'America/New_York') + interval '6 hours')
            AND COALESCE(TRIM(owner_email), '') = ''
        )::int AS outbound_window_without_owner_email
      FROM twilio_call_logs
      WHERE call_started_at >= (CURRENT_DATE - INTERVAL '1 day')
         OR call_started_at IS NULL
    `);
    console.log(JSON.stringify(q.rows[0] || {}, null, 2));
  } finally {
    await c.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

