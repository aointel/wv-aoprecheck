const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function run() {
  const minutes = Math.max(30, Number(process.argv[2] || 60) || 60);
  const client = new Client({ connectionString: DATABASE_URL, statement_timeout: 120000, query_timeout: 120000 });
  await client.connect();
  try {
    const result = await client.query(
      `
      WITH failed_phones AS (
        SELECT DISTINCT RIGHT(REGEXP_REPLACE(COALESCE(t.to_number, ''), '\\D', '', 'g'), 10) AS phone10
        FROM twilio_call_logs t
        WHERE lower(COALESCE(t.call_status, '')) = 'failed'
          AND lower(COALESCE(t.call_direction, '')) LIKE 'outbound%'
          AND t.call_started_at >= NOW() - ($1::int * INTERVAL '1 minute')
          AND length(RIGHT(REGEXP_REPLACE(COALESCE(t.to_number, ''), '\\D', '', 'g'), 10)) = 10
      ),
      targets AS (
        SELECT
          ml.id,
          ml.cnresolution,
          NULLIF(BTRIM(ml.phone_last10), '') AS phone_last10_norm,
          RIGHT(REGEXP_REPLACE(COALESCE(ml.phone::text, ''), '\\D', '', 'g'), 10) AS phone_norm
        FROM masterlead ml
        JOIN failed_phones fp
          ON (
            fp.phone10 = NULLIF(BTRIM(ml.phone_last10), '')
            OR fp.phone10 = RIGHT(REGEXP_REPLACE(COALESCE(ml.phone::text, ''), '\\D', '', 'g'), 10)
          )
      )
      SELECT
        (SELECT COUNT(*)::int FROM failed_phones) AS failed_phones_window,
        (SELECT COUNT(*)::int FROM targets) AS target_rows,
        (SELECT COUNT(*)::int FROM targets WHERE lower(trim(COALESCE(cnresolution, ''))) <> 'failed') AS target_rows_not_failed,
        (SELECT COUNT(*)::int FROM targets WHERE lower(trim(COALESCE(cnresolution, 'pending'))) IN ('pending','new','','null')) AS target_rows_pending_like
      `,
      [minutes]
    );
    console.log(JSON.stringify({ window_minutes: minutes, ...(result.rows[0] || {}) }, null, 2));
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

