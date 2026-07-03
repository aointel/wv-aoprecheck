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
      latest_profiles AS (
        SELECT DISTINCT ON (lower(agent_email))
          lower(agent_email) AS agent_email,
          markets,
          states
        FROM agent_routing_profiles
        ORDER BY lower(agent_email), updated_at DESC
      ),
      globe_profiles AS (
        SELECT lp.agent_email, lp.states
        FROM latest_profiles lp
        WHERE EXISTS (
          SELECT 1
          FROM unnest(COALESCE(lp.markets, ARRAY[]::text[])) m
          WHERE lower(regexp_replace(m, '\\s+', '', 'g')) LIKE '%globe%'
        )
      ),
      globe_dialers_today AS (
        SELECT DISTINCT lower(adm.agent_email) AS agent_email
        FROM agent_dial_metrics adm
        CROSS JOIN bounds b
        WHERE lower(trim(coalesce(adm.event_type, ''))) = 'dial'
          AND adm.event_timestamp >= b.start_ts
          AND adm.event_timestamp < b.end_ts
      ),
      dialer_states AS (
        SELECT
          gd.agent_email,
          upper(regexp_replace(s, '[^A-Za-z]', '', 'g')) AS state
        FROM globe_dialers_today gd
        JOIN globe_profiles gp ON gp.agent_email = gd.agent_email
        CROSS JOIN LATERAL unnest(COALESCE(gp.states, ARRAY[]::text[])) s
      ),
      dialer_states_clean AS (
        SELECT agent_email, state
        FROM dialer_states
        WHERE state ~ '^[A-Z]{2}$'
      ),
      demand_by_state AS (
        SELECT state, COUNT(DISTINCT agent_email)::int AS active_globe_dialers_with_state
        FROM dialer_states_clean
        GROUP BY state
      ),
      active_assignments AS (
        SELECT DISTINCT lead_id
        FROM leasedialer_assignments
        WHERE queue = 'hotlead'
          AND status IN ('queued','active')
      ),
      pool_by_state AS (
        SELECT
          COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), '')) AS state,
          COUNT(*)::int AS available_unowned_unqueued
        FROM masterlead ml
        LEFT JOIN active_assignments a ON a.lead_id = ml.id
        WHERE lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
          AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
          AND COALESCE(btrim(ml.cn_email), '') = ''
          AND a.lead_id IS NULL
          AND lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), ''), '\\s+', '', 'g')) LIKE '%globe%'
        GROUP BY 1
      ),
      coverage AS (
        SELECT
          d.state,
          d.active_globe_dialers_with_state,
          COALESCE(p.available_unowned_unqueued, 0)::int AS available_unowned_unqueued
        FROM demand_by_state d
        LEFT JOIN pool_by_state p ON p.state = d.state
      )
      SELECT
        (SELECT COUNT(*)::int FROM globe_dialers_today) AS globe_dialers_today,
        (SELECT COUNT(*)::int FROM coverage WHERE available_unowned_unqueued = 0) AS states_with_zero_pool_but_active_demand,
        (SELECT COUNT(*)::int FROM coverage WHERE available_unowned_unqueued > 0) AS states_with_nonzero_pool_and_demand,
        (SELECT COALESCE(SUM(active_globe_dialers_with_state),0)::int FROM coverage WHERE available_unowned_unqueued = 0) AS demand_links_on_zero_pool_states,
        (SELECT COALESCE(SUM(active_globe_dialers_with_state),0)::int FROM coverage) AS total_demand_links,
        (
          SELECT json_agg(x ORDER BY x.active_globe_dialers_with_state DESC, x.state ASC)
          FROM (
            SELECT state, active_globe_dialers_with_state, available_unowned_unqueued
            FROM coverage
            WHERE available_unowned_unqueued = 0
            ORDER BY active_globe_dialers_with_state DESC, state ASC
            LIMIT 15
          ) x
        ) AS top_zero_pool_states,
        (
          SELECT json_agg(y ORDER BY y.available_unowned_unqueued ASC, y.state ASC)
          FROM (
            SELECT state, active_globe_dialers_with_state, available_unowned_unqueued
            FROM coverage
            WHERE available_unowned_unqueued > 0
            ORDER BY available_unowned_unqueued ASC, state ASC
            LIMIT 15
          ) y
        ) AS thin_pool_states
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
