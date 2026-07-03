const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function run() {
  const state = String(process.argv[2] || "NJ")
    .trim()
    .toUpperCase();

  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });

  await client.connect();
  try {
    const summary = await client.query(
      `
        SELECT
          lower(la.agent_email) AS agent_email,
          COUNT(*)::int AS callable_count
        FROM leasedialer_assignments la
        JOIN masterlead ml ON ml.id = la.lead_id
        WHERE la.status IN ('queued', 'active')
          AND upper(COALESCE(NULLIF(btrim(ml.taalk_state::text), ''), NULLIF(btrim(ml.state::text), ''))) = $1
          AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
          AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
          AND (
            COALESCE(btrim(ml.cn_email), '') = ''
            OR lower(btrim(ml.cn_email)) = lower(la.agent_email)
          )
        GROUP BY lower(la.agent_email)
        ORDER BY callable_count DESC, agent_email ASC
      `,
      [state],
    );

    const sample = await client.query(
      `
        SELECT
          la.id AS assignment_id,
          lower(la.agent_email) AS agent_email,
          la.status,
          la.assigned_at,
          ml.id AS lead_id,
          upper(COALESCE(NULLIF(btrim(ml.taalk_state::text), ''), NULLIF(btrim(ml.state::text), ''))) AS state,
          COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), NULLIF(btrim(ml.market::text), '')) AS market,
          lower(trim(coalesce(ml.cnresolution, 'pending'))) AS cnresolution
        FROM leasedialer_assignments la
        JOIN masterlead ml ON ml.id = la.lead_id
        WHERE la.status IN ('queued', 'active')
          AND upper(COALESCE(NULLIF(btrim(ml.taalk_state::text), ''), NULLIF(btrim(ml.state::text), ''))) = $1
          AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
          AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
          AND (
            COALESCE(btrim(ml.cn_email), '') = ''
            OR lower(btrim(ml.cn_email)) = lower(la.agent_email)
          )
        ORDER BY la.assigned_at DESC NULLS LAST
        LIMIT 50
      `,
      [state],
    );

    console.log(
      JSON.stringify(
        {
          state,
          agents_with_callable: summary.rows.length,
          by_agent: summary.rows,
          sample_assignments: sample.rows,
        },
        null,
        2,
      ),
    );
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
