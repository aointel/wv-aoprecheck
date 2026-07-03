const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function run() {
  const client = new Client({ connectionString: DATABASE_URL, statement_timeout: 120000, query_timeout: 120000 });
  await client.connect();
  try {
    const summary = await client.query(`
      WITH recent AS (
        SELECT
          call_direction,
          call_status,
          to_number,
          RIGHT(REGEXP_REPLACE(COALESCE(to_number, ''), '\\D', '', 'g'), 10) AS last10,
          length(REGEXP_REPLACE(COALESCE(to_number, ''), '\\D', '', 'g')) AS digit_len
        FROM twilio_call_logs
        WHERE call_started_at >= NOW() - INTERVAL '2 hours'
          AND lower(coalesce(call_status,''))='failed'
          AND lower(coalesce(call_direction,'')) LIKE 'outbound%'
      )
      SELECT
        lower(call_direction) AS direction,
        COUNT(*)::int AS failed_rows,
        COUNT(*) FILTER (WHERE digit_len < 11)::int AS short_digits,
        COUNT(*) FILTER (WHERE digit_len = 11)::int AS nanp_11_digits,
        COUNT(*) FILTER (WHERE digit_len > 11)::int AS long_digits,
        COUNT(*) FILTER (WHERE to_number LIKE 'client:%')::int AS client_targets
      FROM recent
      GROUP BY 1
      ORDER BY 1
    `);

    const examples = await client.query(`
      SELECT twilio_call_sid, owner_email, call_direction, to_number, call_started_at
      FROM twilio_call_logs
      WHERE call_started_at >= NOW() - INTERVAL '2 hours'
        AND lower(coalesce(call_status,''))='failed'
        AND lower(coalesce(call_direction,''))='outbound-dial'
        AND length(REGEXP_REPLACE(COALESCE(to_number, ''), '\\D', '', 'g')) < 11
      ORDER BY call_started_at DESC
      LIMIT 25
    `);

    console.log(JSON.stringify({ summary: summary.rows, bad_outbound_dial_examples: examples.rows }, null, 2));
  } finally {
    await client.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

