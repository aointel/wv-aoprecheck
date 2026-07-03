const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function run() {
  const minutes = Math.max(1, Math.min(60, Number(process.argv[2] || 5)));
  const limit = Math.max(1, Math.min(200, Number(process.argv[3] || 60)));

  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });

  await client.connect();
  try {
    const result = await client.query(
      `
      WITH latest AS (
        SELECT DISTINCT ON (lower(agent_email))
          lower(agent_email) AS agent_email,
          COALESCE(local_leased_lead_count, 0)::int AS local_leased_lead_count,
          updated_at
        FROM leasedialer_client_status
        WHERE updated_at >= NOW() - ($1::int * INTERVAL '1 minute')
        ORDER BY lower(agent_email), updated_at DESC
      ),
      zero_now AS (
        SELECT agent_email, local_leased_lead_count, updated_at
        FROM latest
        WHERE local_leased_lead_count = 0
        ORDER BY updated_at DESC, agent_email ASC
        LIMIT $2
      ),
      profile AS (
        SELECT DISTINCT ON (lower(agent_email))
          lower(agent_email) AS agent_email,
          COALESCE(markets, ARRAY[]::text[]) AS markets,
          COALESCE(states, ARRAY[]::text[]) AS states
        FROM agent_routing_profiles
        ORDER BY lower(agent_email), updated_at DESC
      )
      SELECT
        z.agent_email,
        z.updated_at,
        z.local_leased_lead_count,
        COALESCE(p.markets, ARRAY[]::text[]) AS markets,
        COALESCE(p.states, ARRAY[]::text[]) AS states,
        q.raw_queue_rows,
        q.callable_queue_rows,
        CASE
          WHEN (array_length(COALESCE(p.markets, ARRAY[]::text[]), 1) IS NULL OR array_length(COALESCE(p.markets, ARRAY[]::text[]), 1) = 0)
               OR (array_length(COALESCE(p.states, ARRAY[]::text[]), 1) IS NULL OR array_length(COALESCE(p.states, ARRAY[]::text[]), 1) = 0)
            THEN 'missing_profile'
          WHEN q.raw_queue_rows = 0
            THEN 'no_queue_rows'
          WHEN q.callable_queue_rows = 0
            THEN 'non_callable_or_poisoned_queue'
          ELSE 'has_callable_queue_but_client_zero'
        END AS blocker
      FROM zero_now z
      LEFT JOIN profile p
        ON p.agent_email = z.agent_email
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) FILTER (
            WHERE la.status IN ('queued', 'active')
              AND la.queue = 'hotlead'
          )::int AS raw_queue_rows,
          COUNT(*) FILTER (
            WHERE la.status IN ('queued', 'active')
              AND la.queue = 'hotlead'
              AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
              AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
              AND lower(COALESCE(ml.dnc::text, 'false')) NOT IN ('true', 't', 'yes', '1')
              AND (
                COALESCE(btrim(ml.cn_email), '') = ''
                OR lower(btrim(ml.cn_email)) = z.agent_email
              )
          )::int AS callable_queue_rows
        FROM leasedialer_assignments la
        LEFT JOIN masterlead ml ON ml.id = la.lead_id
        WHERE lower(la.agent_email) = z.agent_email
      ) q ON true
      ORDER BY z.updated_at DESC, z.agent_email ASC
      `,
      [minutes, limit],
    );

    const rows = result.rows || [];
    const blockerSummary = {};
    for (const row of rows) {
      blockerSummary[row.blocker] = (blockerSummary[row.blocker] || 0) + 1;
    }

    console.log(
      JSON.stringify(
        {
          ranAt: new Date().toISOString(),
          windowMinutes: minutes,
          checkedAgents: rows.length,
          blockerSummary,
          rows,
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
