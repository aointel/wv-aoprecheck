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
    const summary = await client.query(
      `
        WITH eligible AS (
          SELECT
            ml.id,
            COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), ''), '??') AS state
          FROM masterlead ml
          WHERE ml.created_at >= NOW() - INTERVAL '6 months'
            AND (
              CASE
                WHEN lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), ''), '\\s+', '', 'g')) LIKE '%veteran%' THEN 'Veteran'
                WHEN lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), ''), '\\s+', '', 'g')) LIKE '%globe%' THEN 'Globe Market'
                ELSE COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), '')
              END
            ) = 'Veteran'
            AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
            AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
        ),
        assigned_active AS (
          SELECT DISTINCT lead_id
          FROM leasedialer_assignments
          WHERE status IN ('queued', 'active')
        )
        SELECT
          COUNT(*)::int AS callable_total,
          COUNT(*) FILTER (WHERE id NOT IN (SELECT lead_id FROM assigned_active))::int AS callable_unassigned_now
        FROM eligible
      `,
    );

    const byState = await client.query(
      `
        WITH eligible AS (
          SELECT
            ml.id,
            COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), ''), '??') AS state
          FROM masterlead ml
          WHERE ml.created_at >= NOW() - INTERVAL '6 months'
            AND (
              CASE
                WHEN lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), ''), '\\s+', '', 'g')) LIKE '%veteran%' THEN 'Veteran'
                WHEN lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), ''), '\\s+', '', 'g')) LIKE '%globe%' THEN 'Globe Market'
                ELSE COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), '')
              END
            ) = 'Veteran'
            AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
            AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
        ),
        assigned_active AS (
          SELECT DISTINCT lead_id
          FROM leasedialer_assignments
          WHERE status IN ('queued', 'active')
        )
        SELECT
          e.state,
          COUNT(*)::int AS callable_total,
          COUNT(*) FILTER (WHERE e.id NOT IN (SELECT lead_id FROM assigned_active))::int AS callable_unassigned_now
        FROM eligible e
        GROUP BY e.state
        ORDER BY callable_total DESC, e.state ASC
        LIMIT 30
      `,
    );

    console.log(
      JSON.stringify(
        {
          window: "last_6_months",
          market: "Veteran",
          filters: {
            cnresolution: ["pending", "new", "", "null"],
            taalk_lead_id_required: true,
          },
          summary: summary.rows[0] || {},
          top_states: byState.rows,
        },
        null,
        2,
      ),
    );
  } finally {
    await client.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
