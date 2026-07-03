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
      WITH active AS (
        SELECT lead_id, lower(agent_email) AS assignment_agent_email
        FROM leasedialer_assignments
        WHERE queue = 'hotlead'
          AND status IN ('queued', 'active')
      ),
      callable_globe AS (
        SELECT
          ml.id AS lead_id,
          lower(COALESCE(btrim(ml.cn_email), '')) AS owner_email,
          COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), ''), 'UNKNOWN') AS state,
          CASE
            WHEN lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), ''), '\\s+', '', 'g')) LIKE '%globe%' THEN 'Globe Market'
            WHEN lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), ''), '\\s+', '', 'g')) LIKE '%veteran%' THEN 'Veteran'
            ELSE COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), '')
          END AS canonical_market,
          lower(trim(coalesce(ml.cnresolution, 'pending'))) AS norm_resolution,
          COALESCE(btrim(ml.taalk_lead_id::text), '') AS taalk_lead_id
        FROM masterlead ml
      ),
      scoped AS (
        SELECT
          c.lead_id,
          c.owner_email,
          c.state,
          a.assignment_agent_email
        FROM callable_globe c
        LEFT JOIN active a ON a.lead_id = c.lead_id
        WHERE c.canonical_market = 'Globe Market'
          AND c.norm_resolution IN ('pending', 'new', '', 'null')
          AND c.taalk_lead_id <> ''
      ),
      scored AS (
        SELECT
          *,
          CASE
            WHEN owner_email = '' AND assignment_agent_email IS NULL THEN 'free_unowned_unassigned'
            WHEN owner_email = '' AND assignment_agent_email IS NOT NULL THEN 'tied_unowned_but_assigned'
            WHEN owner_email <> '' AND assignment_agent_email IS NULL THEN 'tied_owned_no_assignment'
            WHEN owner_email <> '' AND assignment_agent_email = owner_email THEN 'tied_owned_and_assigned_same_owner'
            WHEN owner_email <> '' AND assignment_agent_email IS NOT NULL AND assignment_agent_email <> owner_email THEN 'tied_owner_assignment_mismatch'
            ELSE 'other'
          END AS blocker
        FROM scoped
      )
      SELECT blocker, COUNT(*)::int AS lead_count
      FROM scored
      GROUP BY blocker
      ORDER BY lead_count DESC, blocker ASC
      `,
    );

    const byState = await client.query(
      `
      WITH active AS (
        SELECT lead_id
        FROM leasedialer_assignments
        WHERE queue = 'hotlead'
          AND status IN ('queued', 'active')
      ),
      callable_globe AS (
        SELECT
          ml.id AS lead_id,
          lower(COALESCE(btrim(ml.cn_email), '')) AS owner_email,
          COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), ''), 'UNKNOWN') AS state,
          CASE
            WHEN lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), ''), '\\s+', '', 'g')) LIKE '%globe%' THEN 'Globe Market'
            WHEN lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), ''), '\\s+', '', 'g')) LIKE '%veteran%' THEN 'Veteran'
            ELSE COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), '')
          END AS canonical_market,
          lower(trim(coalesce(ml.cnresolution, 'pending'))) AS norm_resolution,
          COALESCE(btrim(ml.taalk_lead_id::text), '') AS taalk_lead_id
        FROM masterlead ml
      )
      SELECT
        state,
        COUNT(*)::int AS callable_any_owner,
        COUNT(*) FILTER (WHERE owner_email = '')::int AS unowned_callable,
        COUNT(*) FILTER (WHERE owner_email <> '')::int AS owned_callable,
        COUNT(*) FILTER (WHERE owner_email = '' AND lead_id IN (SELECT lead_id FROM active))::int AS unowned_assigned,
        COUNT(*) FILTER (WHERE owner_email <> '' AND lead_id IN (SELECT lead_id FROM active))::int AS owned_assigned
      FROM callable_globe
      WHERE canonical_market = 'Globe Market'
        AND norm_resolution IN ('pending', 'new', '', 'null')
        AND taalk_lead_id <> ''
      GROUP BY state
      ORDER BY callable_any_owner DESC, state ASC
      LIMIT 40
      `,
    );

    console.log(
      JSON.stringify(
        {
          ranAt: new Date().toISOString(),
          market: "Globe Market",
          callable_definition: "cnresolution pending/new/blank/null + taalk_lead_id present",
          blocker_breakdown: summary.rows,
          by_state_top: byState.rows,
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
