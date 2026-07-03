const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function run() {
  const limit = Math.max(1, Math.min(200, Number(process.argv[2] || 50)));
  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 180000,
    query_timeout: 180000,
  });
  await client.connect();
  try {
    const summary = await client.query(
      `
      WITH latest_profile AS (
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
      scoped AS (
        SELECT
          lower(la.agent_email) AS agent_email,
          COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), '')) AS state
        FROM leasedialer_assignments la
        JOIN masterlead ml ON ml.id = la.lead_id
        WHERE la.queue = 'hotlead'
          AND la.status IN ('queued', 'active')
          AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
          AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
          AND (
            COALESCE(btrim(ml.cn_email), '') = ''
            OR lower(btrim(ml.cn_email)) = lower(la.agent_email)
          )
      )
      SELECT
        COUNT(*)::int AS total_callable_rows,
        COUNT(*) FILTER (
          WHERE p.agent_email IS NULL OR array_length(p.states, 1) IS NULL
        )::int AS rows_without_profile,
        COUNT(*) FILTER (
          WHERE p.agent_email IS NOT NULL
            AND array_length(p.states, 1) IS NOT NULL
            AND (s.state IS NULL OR s.state <> ALL(p.states))
        )::int AS rows_outside_profile_states
      FROM scoped s
      LEFT JOIN latest_profile p ON p.agent_email = s.agent_email
      `,
    );

    const top = await client.query(
      `
      WITH latest_profile AS (
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
      scoped AS (
        SELECT
          lower(la.agent_email) AS agent_email,
          COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), '')) AS state
        FROM leasedialer_assignments la
        JOIN masterlead ml ON ml.id = la.lead_id
        WHERE la.queue = 'hotlead'
          AND la.status IN ('queued', 'active')
          AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
          AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
          AND (
            COALESCE(btrim(ml.cn_email), '') = ''
            OR lower(btrim(ml.cn_email)) = lower(la.agent_email)
          )
      )
      SELECT
        s.agent_email,
        COUNT(*)::int AS callable_total,
        COUNT(*) FILTER (
          WHERE p.agent_email IS NOT NULL
            AND array_length(p.states, 1) IS NOT NULL
            AND (s.state IS NULL OR s.state <> ALL(p.states))
        )::int AS poisoned_count
      FROM scoped s
      LEFT JOIN latest_profile p ON p.agent_email = s.agent_email
      GROUP BY s.agent_email
      HAVING COUNT(*) FILTER (
        WHERE p.agent_email IS NOT NULL
          AND array_length(p.states, 1) IS NOT NULL
          AND (s.state IS NULL OR s.state <> ALL(p.states))
      ) > 0
      ORDER BY poisoned_count DESC, callable_total DESC, s.agent_email ASC
      LIMIT $1
      `,
      [limit],
    );

    console.log(
      JSON.stringify(
        {
          ranAt: new Date().toISOString(),
          summary: summary.rows[0] || null,
          top_poisoned_agents: top.rows,
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
