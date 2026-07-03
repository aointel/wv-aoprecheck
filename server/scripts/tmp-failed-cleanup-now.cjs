const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function run() {
  const minutes = Math.max(30, Number(process.argv[2] || 360) || 360);
  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });
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
      target_leads AS (
        SELECT ml.id
        FROM masterlead ml
        JOIN failed_phones fp
          ON (
            fp.phone10 = NULLIF(BTRIM(ml.phone_last10), '')
            OR fp.phone10 = RIGHT(REGEXP_REPLACE(COALESCE(ml.phone::text, ''), '\\D', '', 'g'), 10)
          )
      ),
      released AS (
        UPDATE leasedialer_assignments la
        SET status = 'released',
            released_at = NOW(),
            release_reason = 'failed_call_15m_sync',
            updated_at = NOW()
        WHERE la.status IN ('queued', 'active')
          AND la.lead_id IN (SELECT id FROM target_leads)
        RETURNING la.id
      ),
      marked AS (
        UPDATE masterlead ml
        SET cnresolution = 'failed',
            updated_at = NOW()
        WHERE ml.id IN (SELECT id FROM target_leads)
          AND lower(trim(COALESCE(ml.cnresolution, ''))) <> 'failed'
        RETURNING ml.id
      )
      SELECT
        (SELECT COUNT(*)::int FROM failed_phones) AS failed_phones_window,
        (SELECT COUNT(*)::int FROM released) AS queue_rows_released,
        (SELECT COUNT(*)::int FROM marked) AS masterlead_rows_marked_failed
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

