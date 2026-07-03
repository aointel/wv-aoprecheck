const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function run() {
  const timezone = String(process.argv[2] || "America/Los_Angeles");
  const agentPct = Math.max(0, Math.min(1, Number(process.argv[3] || 0.2))); // 20%

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
      requester_count AS (
        SELECT COUNT(*)::int AS n FROM globe_requesters
      ),
      requester_state_counts AS (
        SELECT
          upper(regexp_replace(s, '[^A-Za-z]', '', 'g')) AS state,
          COUNT(DISTINCT gr.agent_email)::int AS licensed_agents
        FROM globe_requesters gr
        CROSS JOIN LATERAL unnest(COALESCE(gr.states, ARRAY[]::text[])) s
        WHERE upper(regexp_replace(s, '[^A-Za-z]', '', 'g')) ~ '^[A-Z]{2}$'
        GROUP BY 1
      ),
      threshold AS (
        SELECT CEIL((SELECT n FROM requester_count) * $2::numeric)::int AS max_agents
      ),
      rare_states AS (
        SELECT rsc.state, rsc.licensed_agents
        FROM requester_state_counts rsc
        CROSS JOIN threshold t
        WHERE rsc.licensed_agents <= t.max_agents
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
      totals AS (
        SELECT
          COALESCE(SUM(callable_count), 0)::int AS total_callable
        FROM globe_callable_by_state
      ),
      rare_totals AS (
        SELECT
          COALESCE(SUM(g.callable_count), 0)::int AS rare_callable
        FROM globe_callable_by_state g
        JOIN rare_states rs ON rs.state = g.state
      )
      SELECT
        (SELECT n FROM requester_count) AS globe_requesters,
        (SELECT max_agents FROM threshold) AS max_agents_for_rare_state,
        (SELECT COUNT(*)::int FROM rare_states) AS rare_state_count,
        (SELECT total_callable FROM totals) AS total_globe_callable,
        (SELECT rare_callable FROM rare_totals) AS callable_in_rare_states,
        CASE
          WHEN (SELECT total_callable FROM totals) > 0
          THEN ROUND(((SELECT rare_callable FROM rare_totals)::numeric / (SELECT total_callable FROM totals)::numeric) * 100.0, 2)
          ELSE 0
        END AS pct_callable_in_rare_states
      `,
      [timezone, agentPct],
    );

    console.log(JSON.stringify({ timezone, agent_pct_threshold: agentPct, ...(result.rows[0] || {}) }, null, 2));
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
