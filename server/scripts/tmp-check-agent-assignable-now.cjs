const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function run() {
  const email = String(process.argv[2] || "").trim().toLowerCase();
  const queue = String(process.argv[3] || "hotlead").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    throw new Error("usage: node tmp-check-agent-assignable-now.cjs <agentEmail> [queue]");
  }

  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });
  await client.connect();
  try {
    const profile = await client.query(
      `
      SELECT markets, states
      FROM agent_routing_profiles
      WHERE lower(agent_email) = lower($1)
      ORDER BY updated_at DESC
      LIMIT 1
      `,
      [email],
    );
    const markets = Array.isArray(profile.rows[0]?.markets) ? profile.rows[0].markets : [];
    const states = Array.isArray(profile.rows[0]?.states) ? profile.rows[0].states : [];

    const currentCallable = await client.query(
      `
      SELECT COUNT(*)::int AS count
      FROM leasedialer_assignments la
      JOIN masterlead ml ON ml.id = la.lead_id
      WHERE lower(la.agent_email) = lower($1)
        AND la.queue = $2
        AND la.status IN ('queued', 'active')
        AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
        AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
        AND (
          COALESCE(btrim(ml.cn_email), '') = ''
          OR lower(btrim(ml.cn_email)) = lower($1)
        )
      `,
      [email, queue],
    );

    const assignableNow = await client.query(
      `
      WITH routing AS (
        SELECT
          unnest($1::text[]) AS market,
          unnest($2::text[]) AS state
      ),
      active AS (
        SELECT DISTINCT lead_id
        FROM leasedialer_assignments
        WHERE status IN ('queued', 'active')
          AND queue = $3
      ),
      eligible AS (
        SELECT
          ml.id,
          COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), '')) AS state,
          COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), '') AS market
        FROM masterlead ml
        LEFT JOIN active a ON a.lead_id = ml.id
        WHERE a.lead_id IS NULL
          AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
          AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
          AND COALESCE(btrim(ml.cn_email), '') = ''
      )
      SELECT
        COUNT(*)::int AS total_assignable_now
      FROM eligible e
      WHERE EXISTS (
        SELECT 1
        FROM routing r
        WHERE lower(replace(r.market, ' ', '')) = lower(replace(e.market, ' ', ''))
          AND upper(r.state) = e.state
      )
      `,
      [markets, states, queue],
    );

    console.log(
      JSON.stringify(
        {
          email,
          queue,
          routing_profile: { markets, states },
          callable_currently_in_queue: currentCallable.rows[0]?.count || 0,
          assignable_now_matching_profile: assignableNow.rows[0]?.total_assignable_now || 0,
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
