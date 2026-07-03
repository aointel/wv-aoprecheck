const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function run() {
  const minutes = Math.max(1, Math.min(120, Number(process.argv[2] || 10)));
  const limit = Math.max(1, Math.min(100, Number(process.argv[3] || 50)));
  const client = new Client({ connectionString: DATABASE_URL, statement_timeout: 120000, query_timeout: 120000 });
  await client.connect();
  try {
    const res = await client.query(
      `
      WITH recent_zero AS (
        SELECT lower(agent_email) AS agent_email, updated_at
        FROM leasedialer_client_status
        WHERE updated_at >= NOW() - ($1::int * INTERVAL '1 minute')
          AND COALESCE(local_leased_lead_count, 0) = 0
      ),
      profile AS (
        SELECT DISTINCT ON (lower(agent_email))
          lower(agent_email) AS agent_email,
          ARRAY(
            SELECT upper(regexp_replace(s, '[^A-Za-z]', '', 'g'))
            FROM unnest(COALESCE(states, ARRAY[]::text[])) s
            WHERE upper(regexp_replace(s, '[^A-Za-z]', '', 'g')) <> ''
          ) AS states
        FROM agent_routing_profiles
        ORDER BY lower(agent_email), updated_at DESC
      ),
      q AS (
        SELECT
          rz.agent_email,
          rz.updated_at,
          p.states AS profile_states,
          COUNT(*) FILTER (
            WHERE la.status IN ('queued','active')
              AND la.queue = 'hotlead'
          )::int AS raw_queue_rows,
          COUNT(*) FILTER (
            WHERE la.status IN ('queued','active')
              AND la.queue = 'hotlead'
              AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
              AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
              AND (
                COALESCE(btrim(ml.cn_email), '') = ''
                OR lower(btrim(ml.cn_email)) = rz.agent_email
              )
          )::int AS callable_rows,
          COUNT(*) FILTER (
            WHERE la.status IN ('queued','active')
              AND la.queue = 'hotlead'
              AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
              AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
              AND (
                COALESCE(btrim(ml.cn_email), '') = ''
                OR lower(btrim(ml.cn_email)) = rz.agent_email
              )
              AND p.states IS NOT NULL
              AND array_length(p.states, 1) IS NOT NULL
              AND COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), '')) = ANY(p.states)
          )::int AS strict_callable_rows
        FROM recent_zero rz
        LEFT JOIN profile p ON p.agent_email = rz.agent_email
        LEFT JOIN leasedialer_assignments la ON lower(la.agent_email) = rz.agent_email
        LEFT JOIN masterlead ml ON ml.id = la.lead_id
        GROUP BY rz.agent_email, rz.updated_at, p.states
      )
      SELECT
        agent_email,
        updated_at,
        raw_queue_rows,
        callable_rows,
        strict_callable_rows,
        CASE
          WHEN profile_states IS NULL OR array_length(profile_states, 1) IS NULL THEN 'missing_profile_states'
          WHEN raw_queue_rows = 0 THEN 'no_queue_rows'
          WHEN callable_rows = 0 THEN 'all_rows_non_callable'
          WHEN strict_callable_rows = 0 THEN 'queue_poisoned_state_mismatch'
          ELSE 'other'
        END AS blocker
      FROM q
      WHERE strict_callable_rows = 0
      ORDER BY updated_at DESC, agent_email ASC
      LIMIT $2
      `,
      [minutes, limit],
    );

    const summary = {};
    for (const r of res.rows) summary[r.blocker] = (summary[r.blocker] || 0) + 1;
    console.log(JSON.stringify({ ranAt: new Date().toISOString(), windowMinutes: minutes, total: res.rows.length, blocker_summary: summary, rows: res.rows }, null, 2));
  } finally {
    await client.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
