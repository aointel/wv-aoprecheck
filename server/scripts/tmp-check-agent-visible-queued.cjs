const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function run() {
  const email = String(process.argv[2] || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    throw new Error("usage: node tmp-check-agent-visible-queued.cjs <agentEmail>");
  }
  const client = new Client({ connectionString: DATABASE_URL, statement_timeout: 120000, query_timeout: 120000 });
  await client.connect();
  try {
    const res = await client.query(
      `
      WITH profile AS (
        SELECT states
        FROM agent_routing_profiles
        WHERE lower(agent_email) = lower($1)
        ORDER BY updated_at DESC
        LIMIT 1
      ),
      scoped AS (
        SELECT
          COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), '')) AS state
        FROM leasedialer_assignments la
        JOIN masterlead ml ON ml.id = la.lead_id
        WHERE lower(la.agent_email) = lower($1)
          AND la.queue = 'hotlead'
          AND la.status = 'queued'
          AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
          AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
          AND (COALESCE(btrim(ml.cn_email), '') = '' OR lower(btrim(ml.cn_email)) = lower($1))
      )
      SELECT
        COUNT(*)::int AS queued_callable_total,
        COUNT(*) FILTER (
          WHERE state = ANY(
            COALESCE((SELECT ARRAY(SELECT upper(regexp_replace(s, '[^A-Za-z]', '', 'g')) FROM unnest(states) s) FROM profile), ARRAY[]::text[])
          )
        )::int AS queued_callable_in_profile_states,
        COUNT(*) FILTER (
          WHERE state IS NULL OR state = '' OR state NOT IN (
            SELECT upper(regexp_replace(s, '[^A-Za-z]', '', 'g')) FROM profile, unnest(states) s
          )
        )::int AS queued_callable_outside_profile_states
      FROM scoped
      `,
      [email],
    );

    const topStates = await client.query(
      `
      SELECT
        COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), ''), 'UNKNOWN') AS state,
        COUNT(*)::int AS count
      FROM leasedialer_assignments la
      JOIN masterlead ml ON ml.id = la.lead_id
      WHERE lower(la.agent_email) = lower($1)
        AND la.queue = 'hotlead'
        AND la.status = 'queued'
        AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
        AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
        AND (COALESCE(btrim(ml.cn_email), '') = '' OR lower(btrim(ml.cn_email)) = lower($1))
      GROUP BY 1
      ORDER BY count DESC, state ASC
      LIMIT 10
      `,
      [email],
    );

    const strictAssignable = await client.query(
      `
      WITH profile AS (
        SELECT markets, states
        FROM agent_routing_profiles
        WHERE lower(agent_email) = lower($1)
        ORDER BY updated_at DESC
        LIMIT 1
      ),
      active AS (
        SELECT DISTINCT lead_id
        FROM leasedialer_assignments
        WHERE queue = 'hotlead'
          AND status IN ('queued', 'active')
      )
      SELECT COUNT(*)::int AS strict_unassigned_matching_now
      FROM masterlead ml
      CROSS JOIN profile p
      LEFT JOIN active a ON a.lead_id = ml.id
      WHERE a.lead_id IS NULL
        AND (
          CASE
            WHEN lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text)), '\\s+', '', 'g')) LIKE '%globe%' THEN 'Globe Market'
            WHEN lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text)), '\\s+', '', 'g')) LIKE '%veteran%' THEN 'Veteran'
            ELSE COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text))
          END
        ) = ANY(p.markets)
        AND COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), '')) = ANY(
          ARRAY(SELECT upper(regexp_replace(s, '[^A-Za-z]', '', 'g')) FROM unnest(p.states) s)
        )
        AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
        AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
        AND COALESCE(btrim(ml.cn_email), '') = ''
      `,
      [email],
    );

    console.log(
      JSON.stringify(
        {
          email,
          counts: res.rows[0] || null,
          strict_unassigned_matching_now: strictAssignable.rows[0]?.strict_unassigned_matching_now || 0,
          top_states: topStates.rows,
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
