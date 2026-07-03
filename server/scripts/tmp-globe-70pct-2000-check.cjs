const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function run() {
  const timezone = String(process.argv[2] || "America/Los_Angeles");
  const workableThreshold = Math.max(0, Number(process.argv[3] || 2000));
  const sharedPct = Math.max(0, Math.min(1, Number(process.argv[4] || 0.7)));

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
      globe_agents AS (
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
      dialers AS (
        SELECT gd.agent_email, ga.states
        FROM globe_dialers_today gd
        JOIN globe_agents ga ON ga.agent_email = gd.agent_email
      ),
      dialer_states AS (
        SELECT
          d.agent_email,
          upper(regexp_replace(s, '[^A-Za-z]', '', 'g')) AS state
        FROM dialers d
        CROSS JOIN LATERAL unnest(COALESCE(d.states, ARRAY[]::text[])) s
      ),
      dialer_states_clean AS (
        SELECT agent_email, state
        FROM dialer_states
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
      per_agent_workable AS (
        SELECT
          dsc.agent_email,
          COALESCE(SUM(gcs.callable_count), 0)::int AS workable_callable
        FROM dialer_states_clean dsc
        LEFT JOIN globe_callable_by_state gcs ON gcs.state = dsc.state
        GROUP BY dsc.agent_email
      ),
      dialer_count AS (
        SELECT COUNT(*)::int AS n FROM per_agent_workable
      ),
      low_workable AS (
        SELECT COUNT(*)::int AS n
        FROM per_agent_workable
        WHERE workable_callable <= $2
      ),
      state_dialer_counts AS (
        SELECT
          dsc.state,
          COUNT(DISTINCT dsc.agent_email)::int AS dialer_count
        FROM dialer_states_clean dsc
        GROUP BY dsc.state
      ),
      shared_threshold AS (
        SELECT CEIL((SELECT n FROM dialer_count) * $3::numeric)::int AS min_dialers
      ),
      states_shared_by_pct AS (
        SELECT sdc.state, sdc.dialer_count
        FROM state_dialer_counts sdc
        CROSS JOIN shared_threshold st
        WHERE sdc.dialer_count >= st.min_dialers
      ),
      callable_in_shared_states AS (
        SELECT COALESCE(SUM(gcs.callable_count), 0)::int AS n
        FROM globe_callable_by_state gcs
        JOIN states_shared_by_pct ssp ON ssp.state = gcs.state
      )
      SELECT
        (SELECT n FROM dialer_count) AS globe_dialers_today,
        (SELECT n FROM low_workable) AS dialers_workable_lte_threshold,
        CASE WHEN (SELECT n FROM dialer_count) > 0
          THEN ROUND(((SELECT n FROM low_workable)::numeric / (SELECT n FROM dialer_count)::numeric) * 100.0, 2)
          ELSE 0 END AS pct_dialers_workable_lte_threshold,
        $2::int AS workable_threshold,
        (SELECT min_dialers FROM shared_threshold) AS min_dialers_for_shared_states,
        (SELECT COUNT(*)::int FROM states_shared_by_pct) AS shared_state_count,
        (SELECT n FROM callable_in_shared_states) AS callable_in_shared_states,
        (
          SELECT json_agg(x ORDER BY x.dialer_count DESC, x.state ASC)
          FROM (
            SELECT ssp.state, ssp.dialer_count, COALESCE(gcs.callable_count, 0)::int AS callable_count
            FROM states_shared_by_pct ssp
            LEFT JOIN globe_callable_by_state gcs ON gcs.state = ssp.state
            ORDER BY ssp.dialer_count DESC, ssp.state ASC
            LIMIT 20
          ) x
        ) AS shared_states_sample
      `,
      [timezone, workableThreshold, sharedPct],
    );

    console.log(
      JSON.stringify(
        {
          timezone,
          workable_threshold: workableThreshold,
          shared_pct: sharedPct,
          ...(result.rows[0] || {}),
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
