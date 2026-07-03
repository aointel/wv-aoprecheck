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
    const result = await client.query(`
      WITH target AS (
        SELECT ml.id
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
      ),
      updated AS (
        UPDATE masterlead ml
        SET cnresolution = 'failed',
            updated_at = NOW()
        FROM target t
        WHERE ml.id = t.id
        RETURNING ml.id
      )
      SELECT COUNT(*)::int AS rows_marked_failed
      FROM updated
    `);

    console.log(JSON.stringify(result.rows[0] || {}, null, 2));
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

