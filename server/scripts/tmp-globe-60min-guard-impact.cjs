const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function run() {
  const minutes = Math.max(1, Number(process.argv[2] || 60));
  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });
  await client.connect();
  try {
    const result = await client.query(
      `
      WITH globe_callable AS (
        SELECT
          ml.id,
          COALESCE(btrim(ml.cn_email), '') AS owner_email
        FROM masterlead ml
        WHERE lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
          AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
          AND lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), ''), '\\s+', '', 'g')) LIKE '%globe%'
      ),
      active_assignments AS (
        SELECT la.*
        FROM leasedialer_assignments la
        WHERE la.queue = 'hotlead'
          AND la.status IN ('queued', 'active')
      ),
      joined AS (
        SELECT
          gc.id,
          gc.owner_email,
          aa.id AS assignment_id,
          aa.status,
          aa.assigned_at,
          aa.updated_at
        FROM globe_callable gc
        LEFT JOIN active_assignments aa ON aa.lead_id = gc.id
      )
      SELECT
        COUNT(*)::int AS total_globe_callable,
        COUNT(*) FILTER (WHERE assignment_id IS NOT NULL)::int AS queued_or_active_now,
        COUNT(*) FILTER (
          WHERE assignment_id IS NOT NULL
            AND COALESCE(updated_at, assigned_at, NOW() - INTERVAL '100 years') >= NOW() - ($1::int * INTERVAL '1 minute')
        )::int AS queued_or_active_recent_window,
        COUNT(*) FILTER (
          WHERE assignment_id IS NULL
            AND owner_email <> ''
        )::int AS owned_not_queued,
        COUNT(*) FILTER (
          WHERE assignment_id IS NULL
            AND owner_email = ''
        )::int AS free_unowned_unqueued
      FROM joined
      `,
      [minutes],
    );

    console.log(JSON.stringify({ minutes_window: minutes, ...(result.rows[0] || {}) }, null, 2));
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
