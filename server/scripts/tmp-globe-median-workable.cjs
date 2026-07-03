const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function run() {
  const timezone = String(process.argv[2] || "America/Los_Angeles");
  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });
  await client.connect();
  try {
    const result = await client.query(
      `
      WITH bounds AS (
        SELECT
          (((now() AT TIME ZONE $1)::date)::timestamp AT TIME ZONE $1) AS start_ts,
          ((((now() AT TIME ZONE $1)::date + 1)::timestamp) AT TIME ZONE $1) AS end_ts
      ),
      requesters AS (
        SELECT DISTINCT lower(agent_email) AS agent_email
        FROM leasedialer_client_status lcs
        CROSS JOIN bounds b
        WHERE lcs.updated_at >= b.start_ts
          AND lcs.updated_at < b.end_ts
      ),
      latest_profiles AS (
        SELECT DISTINCT ON (lower(agent_email))
          lower(agent_email) AS agent_email,
          markets,
          states
        FROM agent_routing_profiles
        ORDER BY lower(agent_email), updated_at DESC
      ),
      globe_requesters AS (
        SELECT r.agent_email, lp.states
        FROM requesters r
        JOIN latest_profiles lp ON lp.agent_email = r.agent_email
        WHERE EXISTS (
          SELECT 1
          FROM unnest(COALESCE(lp.markets, ARRAY[]::text[])) m
          WHERE lower(regexp_replace(m, '\\s+', '', 'g')) LIKE '%globe%'
        )
      ),
      requester_states AS (
        SELECT
          gr.agent_email,
          upper(regexp_replace(s, '[^A-Za-z]', '', 'g')) AS state
        FROM globe_requesters gr
        CROSS JOIN LATERAL unnest(COALESCE(gr.states, ARRAY[]::text[])) s
      ),
      requester_states_clean AS (
        SELECT agent_email, state
        FROM requester_states
        WHERE state ~ '^[A-Z]{2}$'
      ),
      globe_callable_by_state AS (
        SELECT
          COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), '')) AS state,
          COUNT(*)::int AS callable_count
        FROM masterlead ml
        WHERE lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
          AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
          AND lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), ''), '\\s+', '', 'g')) LIKE '%globe%'
        GROUP BY 1
      ),
      per_agent AS (
        SELECT
          rsc.agent_email,
          COUNT(DISTINCT rsc.state)::int AS state_count,
          COALESCE(SUM(gcs.callable_count), 0)::int AS workable_callable
        FROM requester_states_clean rsc
        LEFT JOIN globe_callable_by_state gcs ON gcs.state = rsc.state
        GROUP BY rsc.agent_email
      )
      SELECT
        (SELECT COUNT(*)::int FROM per_agent) AS globe_requesters_with_states,
        (SELECT COALESCE(SUM(callable_count),0)::int FROM globe_callable_by_state) AS total_globe_callable,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY workable_callable) AS median_workable_callable,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY state_count) AS median_state_count,
        AVG(workable_callable)::numeric(12,2) AS avg_workable_callable
      FROM per_agent
      `,
      [timezone],
    );

    console.log(JSON.stringify(result.rows[0] || {}, null, 2));
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
